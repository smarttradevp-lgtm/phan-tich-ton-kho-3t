import { Hono } from "hono";
import type { AppEnv } from "../types";
import { canVaiTro } from "../middleware/session";
import { lenhNhatKy } from "../lib/nhatKy";
import { bamKhoa, taoKhoa, TAP_DU_LIEU } from "../lib/khoaApi";
import { hubLaNguonTon } from "../lib/khoMisa";
import { nowVN } from "../lib/vnTime";

// Quan tri du lieu - chi Admin: thong ke dung luong theo bang, phien ton kho, don dep du lieu cu, nhat ky thao tac.
const quanTri = new Hono<AppEnv>();
quanTri.use("*", canVaiTro("admin"));

const BANG = ["so_chi_tiet", "xuat_thang", "ton_kho", "ton_kho_phien", "lk_khai_bao", "linh_kien", "kho", "import_log", "nhat_ky", "users"] as const;
const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const THANG_RE = /^\d{6}$/;

quanTri.get("/du-lieu", async (c) => {
  const db = c.env.DB;
  const [dem, phien, sct, xt] = await Promise.all([
    db.batch(BANG.map((b) => db.prepare(`SELECT COUNT(*) AS n FROM ${b}`))),
    db.prepare(
      `SELECT p.id, p.phien_ban, p.nguon, p.ten_file, p.nguoi, p.trang_thai, p.ky_tu_ngay, p.ky_den_ngay, p.so_dong_kho, p.so_dong_ktv, p.bat_dau_luc, p.xong_luc,
              (SELECT COUNT(*) FROM ton_kho t WHERE t.phien_id = p.id) AS so_dong
       FROM ton_kho_phien p ORDER BY p.id DESC LIMIT 100`,
    ).all(),
    db.prepare("SELECT substr(ngay_hach_toan, 1, 7) AS thang, COUNT(*) AS n FROM so_chi_tiet GROUP BY 1 ORDER BY 1 DESC").all(),
    db.prepare("SELECT thang, nguon, COUNT(*) AS n, SUM(sl_xuat) AS sl FROM xuat_thang GROUP BY thang, nguon ORDER BY thang DESC").all(),
  ]);
  const moiNhat = (phien.results as { id: number; trang_thai: string }[]).find((p) => p.trang_thai === "xong")?.id ?? null;
  return c.json({
    bang: BANG.map((b, i) => ({ bang: b, so_dong: (dem[i].results[0] as { n: number }).n })),
    phien_ton: phien.results.map((p) => ({ ...p, dang_dung: p.id === moiNhat })),
    so_chi_tiet_theo_thang: sct.results,
    xuat_thang: xt.results,
  });
});

// Xoa 1 phien ton kho (khong xoa duoc phien dang dung cho bao cao).
quanTri.delete("/phien-ton/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = c.env.DB;
  const moiNhat = await db.prepare("SELECT id FROM ton_kho_phien WHERE trang_thai = 'xong' ORDER BY id DESC LIMIT 1").first<number>("id");
  if (id === moiNhat) return c.json({ error: "PHIEN_DANG_DUNG" }, 400);
  const r = await db.batch([
    db.prepare("DELETE FROM ton_kho WHERE phien_id = ?").bind(id),
    db.prepare("DELETE FROM ton_kho_phien WHERE id = ?").bind(id),
    lenhNhatKy(db, c.get("user").email, "Xoá phiên tồn kho", { id }),
  ]);
  if (!r[1].meta.changes) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true, da_xoa: r[0].meta.changes });
});

// Don dep: so chi tiet truoc ngay X (xuat cac thang do nen da chot tinh truoc), xuat tinh cua 1 thang, phien ton cu (giu N phien moi nhat).
quanTri.post("/don-dep", async (c) => {
  const b = await c.req.json<{ so_chi_tiet_truoc?: string; xuat_thang?: string; giu_phien_ton?: number }>();
  const db = c.env.DB;
  const email = c.get("user").email;
  if (b.so_chi_tiet_truoc) {
    if (!NGAY_RE.test(b.so_chi_tiet_truoc)) return c.json({ error: "NGAY_KHONG_HOP_LE" }, 400);
    // Chi xoa thang da co trong xuat_thang (tinh) -> bao cao dap chieu khong mat so lieu.
    const r = await db.batch([
      db.prepare(
        `DELETE FROM so_chi_tiet WHERE ngay_hach_toan < ?
           AND substr(ngay_hach_toan, 1, 4) || substr(ngay_hach_toan, 6, 2) IN (SELECT DISTINCT thang FROM xuat_thang)`,
      ).bind(b.so_chi_tiet_truoc),
      lenhNhatKy(db, email, "Dọn sổ chi tiết", { truoc: b.so_chi_tiet_truoc }),
    ]);
    return c.json({ ok: true, da_xoa: r[0].meta.changes });
  }
  if (b.xuat_thang) {
    if (!THANG_RE.test(b.xuat_thang)) return c.json({ error: "THANG_KHONG_HOP_LE" }, 400);
    const r = await db.batch([
      db.prepare("DELETE FROM xuat_thang WHERE thang = ?").bind(b.xuat_thang),
      lenhNhatKy(db, email, "Xoá xuất tháng tĩnh", { thang: b.xuat_thang }),
    ]);
    return c.json({ ok: true, da_xoa: r[0].meta.changes });
  }
  if (b.giu_phien_ton != null) {
    const giu = Math.max(1, Math.floor(b.giu_phien_ton));
    const giuSql = `SELECT id FROM ton_kho_phien WHERE trang_thai = 'xong' ORDER BY id DESC LIMIT ${giu}`;
    const r = await db.batch([
      db.prepare(`DELETE FROM ton_kho WHERE phien_id NOT IN (${giuSql}) AND phien_id NOT IN (SELECT id FROM ton_kho_phien WHERE trang_thai = 'dang_keo')`),
      db.prepare(`DELETE FROM ton_kho_phien WHERE id NOT IN (${giuSql}) AND trang_thai <> 'dang_keo'`),
      lenhNhatKy(db, email, "Dọn phiên tồn kho cũ", { giu }),
    ]);
    return c.json({ ok: true, da_xoa: r[1].meta.changes });
  }
  return c.json({ error: "THIEU_THAM_SO" }, 400);
});

quanTri.get("/nhat-ky", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT luc, nguoi, hanh_dong, chi_tiet, 'thao_tac' AS loai FROM nhat_ky
     UNION ALL
     SELECT luc, nguoi, 'Import ' || loai, COALESCE(ten_file, '') || CASE WHEN so_dong THEN ' · ' || so_dong || ' dòng' ELSE '' END || COALESCE(' · ' || ghi_chu, ''), 'import' FROM import_log
     ORDER BY luc DESC LIMIT 300`,
  ).all();
  return c.json({ rows: results });
});

// ---------------------------------------------------------------- Kho du lieu MISA: khoa API doi tac + cong tac nguon ton
quanTri.get("/kho-misa", async (c) => {
  const db = c.env.DB;
  const [khoa, bao] = await Promise.all([
    db.prepare("SELECT id, ten, tien_to, quyen, bat_tat, tao_luc, tao_boi, dung_cuoi_luc, phien_ton_da_keo, phien_ton_keo_luc FROM doi_tac_api_key ORDER BY id").all(),
    db.prepare("SELECT value, updated_at FROM app_settings WHERE key = 'thong_bao_phien_ton'").first<{ value: string; updated_at: string }>(),
  ]);
  return c.json({
    hub_la_nguon_ton: await hubLaNguonTon(db),
    co_khoa_bao: !!c.env.HUB_SYNC_KEY,
    thong_bao: bao ? { ...JSON.parse(bao.value), luc: bao.updated_at } : null,
    khoa: khoa.results.map((k) => ({ ...k, quyen: JSON.parse(String(k.quyen)) })),
    tap_du_lieu: TAP_DU_LIEU,
  });
});

// Tao khoa: tra khoa goc DUY NHAT 1 lan (chi luu ban bam).
quanTri.post("/kho-misa/khoa", async (c) => {
  const b = await c.req.json<{ ten?: string; quyen?: string[] }>();
  const ten = (b.ten ?? "").trim();
  const quyen = (b.quyen ?? []).filter((q) => (TAP_DU_LIEU as readonly string[]).includes(q));
  if (!ten || !quyen.length) return c.json({ error: "THIEU_TEN_HOAC_QUYEN" }, 400);
  const khoa = taoKhoa();
  const db = c.env.DB;
  await db.batch([
    db.prepare("INSERT INTO doi_tac_api_key (ten, khoa_bam, tien_to, quyen, tao_luc, tao_boi) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(ten, await bamKhoa(khoa), khoa.slice(0, 6), JSON.stringify(quyen), nowVN(), c.get("user").email),
    lenhNhatKy(db, c.get("user").email, "Tạo khoá API đối tác", { ten, quyen }),
  ]);
  return c.json({ ok: true, khoa });
});

quanTri.patch("/kho-misa/khoa/:id", async (c) => {
  const b = await c.req.json<{ bat_tat?: boolean; quyen?: string[] }>();
  const db = c.env.DB;
  const quyen = b.quyen ? JSON.stringify(b.quyen.filter((q) => (TAP_DU_LIEU as readonly string[]).includes(q))) : null;
  const r = await db.batch([
    db.prepare("UPDATE doi_tac_api_key SET bat_tat = COALESCE(?, bat_tat), quyen = COALESCE(?, quyen) WHERE id = ?")
      .bind(b.bat_tat == null ? null : b.bat_tat ? 1 : 0, quyen, Number(c.req.param("id"))),
    lenhNhatKy(db, c.get("user").email, "Sửa khoá API đối tác", { id: Number(c.req.param("id")), ...b }),
  ]);
  if (!r[0].meta.changes) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

quanTri.delete("/kho-misa/khoa/:id", async (c) => {
  const db = c.env.DB;
  const r = await db.batch([
    db.prepare("DELETE FROM doi_tac_api_key WHERE id = ?").bind(Number(c.req.param("id"))),
    lenhNhatKy(db, c.get("user").email, "Xoá khoá API đối tác", { id: Number(c.req.param("id")) }),
  ]);
  if (!r[0].meta.changes) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

// Cong tac: app nay la nguon ton kho (thoi keo ton tu linh-kien-app). Bat o giai doan 2 (chuyen nguon).
quanTri.put("/kho-misa/nguon-ton", async (c) => {
  const b = await c.req.json<{ hub_la_nguon_ton?: boolean }>();
  const db = c.env.DB;
  await db.batch([
    db.prepare("INSERT INTO app_settings (key, value, nguoi_cap_nhat, updated_at) VALUES ('hub_la_nguon_ton', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, nguoi_cap_nhat = excluded.nguoi_cap_nhat, updated_at = excluded.updated_at")
      .bind(b.hub_la_nguon_ton ? "1" : "0", c.get("user").email, nowVN()),
    lenhNhatKy(db, c.get("user").email, "Đổi nguồn tồn kho", { hub_la_nguon_ton: !!b.hub_la_nguon_ton }),
  ]);
  return c.json({ ok: true });
});

// Doi chieu 2 phien ton kho (giai doan chay song song: phien nhap o app nay vs phien keo tu linh-kien-app cung file).
// Tong cuoi ky theo kho + danh sach (ma kho x ma hang) lech, toi da 500 dong.
quanTri.get("/doi-chieu-phien", async (c) => {
  const a = Number(c.req.query("a")), b = Number(c.req.query("b"));
  if (!a || !b || a === b) return c.json({ error: "CHON_2_PHIEN" }, 400);
  const db = c.env.DB;
  const [phien, theoKho, lech, demLech] = await Promise.all([
    db.prepare("SELECT id, nguon, ten_file, phien_ban, xong_luc, ky_tu_ngay, ky_den_ngay FROM ton_kho_phien WHERE id IN (?, ?)").bind(a, b).all(),
    db.prepare(
      `SELECT ma_kho, MAX(ten_kho) AS ten_kho, SUM(CASE WHEN phien_id = ?1 THEN cuoi_ky ELSE 0 END) AS a, SUM(CASE WHEN phien_id = ?2 THEN cuoi_ky ELSE 0 END) AS b,
              SUM(phien_id = ?1) AS dong_a, SUM(phien_id = ?2) AS dong_b
       FROM ton_kho WHERE phien_id IN (?1, ?2) GROUP BY ma_kho ORDER BY ABS(a - b) DESC, ma_kho`,
    ).bind(a, b).all(),
    db.prepare(
      `SELECT ma_kho, ma_hang, MAX(ten_hang) AS ten_hang, SUM(CASE WHEN phien_id = ?1 THEN cuoi_ky ELSE 0 END) AS a, SUM(CASE WHEN phien_id = ?2 THEN cuoi_ky ELSE 0 END) AS b
       FROM ton_kho WHERE phien_id IN (?1, ?2) GROUP BY ma_kho, ma_hang HAVING ABS(a - b) > 0.0001 ORDER BY ABS(a - b) DESC LIMIT 500`,
    ).bind(a, b).all(),
    db.prepare(
      `SELECT COUNT(*) AS n FROM (SELECT 1 FROM ton_kho WHERE phien_id IN (?1, ?2) GROUP BY ma_kho, ma_hang
         HAVING ABS(SUM(CASE WHEN phien_id = ?1 THEN cuoi_ky ELSE 0 END) - SUM(CASE WHEN phien_id = ?2 THEN cuoi_ky ELSE 0 END)) > 0.0001)`,
    ).bind(a, b).first<number>("n"),
  ]);
  return c.json({ phien: phien.results, theo_kho: theoKho.results, lech: lech.results, so_dong_lech: demLech ?? 0 });
});

export default quanTri;
