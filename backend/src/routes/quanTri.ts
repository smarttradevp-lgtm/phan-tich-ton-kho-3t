import { Hono } from "hono";
import type { AppEnv } from "../types";
import { canVaiTro } from "../middleware/session";
import { lenhNhatKy } from "../lib/nhatKy";

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

export default quanTri;
