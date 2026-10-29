import { Hono } from "hono";
import type { AppEnv } from "../types";
import { canVaiTro } from "../middleware/session";
import { nowVN } from "../lib/vnTime";
import { docThamSoDb } from "../lib/duLieuBaoCao";
import { docThamSo, THAM_SO_MAC_DINH } from "../lib/tinhToan/thamSo";

// Cai dat: tham so chung, khai bao LK, phan loai + he so thu hoi, ma tran thu hoi, kho. Xem: moi vai tro; ghi: nhap_lieu+.
const caiDat = new Hono<AppEnv>();
const ghi = canVaiTro("nhap_lieu");

const chuoi = (v: unknown) => (v == null ? null : String(v).trim() || null);
const soHoacNull = (v: unknown) => {
  if (v == null || (typeof v === "string" && v.trim() === "")) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------- Tham so
caiDat.get("/tham-so", async (c) => c.json({ tham_so: await docThamSoDb(c.env.DB), mac_dinh: THAM_SO_MAC_DINH }));

caiDat.put("/tham-so", ghi, async (c) => {
  const ts = docThamSo(await c.req.json());
  await c.env.DB.prepare(
    "INSERT INTO app_settings (key, value, nguoi_cap_nhat, updated_at) VALUES ('tham_so', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, nguoi_cap_nhat = excluded.nguoi_cap_nhat, updated_at = excluded.updated_at",
  )
    .bind(JSON.stringify(ts), c.get("user").email, nowVN())
    .run();
  return c.json({ tham_so: ts });
});

// ---------------------------------------------------------------- Khai bao LK
// Danh sach = danh muc dong bo tu linh-kien-app + ma chi co trong khai bao. chua_khai_bao=1: thieu phan loai.
caiDat.get("/lk", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT m.ma, COALESCE(l.ten, k.ten) AS ten, l.nhom_lk, l.gia_du_phong, l.bat_tat, l.ma IS NOT NULL AS co_trong_danh_muc,
            k.phan_loai, k.nganh, k.noi_san_xuat, k.he_so_du_tru, k.leadtime, k.doi_tac, k.nhom_tuong_duong,
            k.gia_nhap, k.gia_nhap_nguon, k.gia_nhap_luc, k.nguoi_cap_nhat, k.ngay_cap_nhat
     FROM (SELECT ma FROM lk_khai_bao UNION SELECT ma FROM linh_kien) m
     LEFT JOIN lk_khai_bao k ON k.ma = m.ma
     LEFT JOIN linh_kien l ON l.ma = m.ma
     ORDER BY m.ma`,
  ).all();
  return c.json({ rows: results });
});

// Sua 1 LK - gui gia tri null / "" de XOA khai bao cua truong do (khac import: o trong = giu).
caiDat.put("/lk/:ma", ghi, async (c) => {
  const ma = (c.req.param("ma") ?? "").trim();
  const b = await c.req.json<Record<string, unknown>>();
  const luc = nowVN();
  const gia = soHoacNull(b.gia_nhap);
  await c.env.DB.prepare(
    `INSERT INTO lk_khai_bao (ma, ten, phan_loai, nganh, noi_san_xuat, he_so_du_tru, leadtime, doi_tac, nhom_tuong_duong, gia_nhap, gia_nhap_nguon, gia_nhap_luc, nguoi_cap_nhat, ngay_cap_nhat)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CASE WHEN ?10 IS NOT NULL THEN 'tay' END, CASE WHEN ?10 IS NOT NULL THEN ?12 END, ?11, ?12)
     ON CONFLICT(ma) DO UPDATE SET ten = excluded.ten, phan_loai = excluded.phan_loai, nganh = excluded.nganh, noi_san_xuat = excluded.noi_san_xuat,
       he_so_du_tru = excluded.he_so_du_tru, leadtime = excluded.leadtime, doi_tac = excluded.doi_tac, nhom_tuong_duong = excluded.nhom_tuong_duong,
       gia_nhap_nguon = CASE WHEN excluded.gia_nhap IS NOT gia_nhap THEN excluded.gia_nhap_nguon ELSE gia_nhap_nguon END,
       gia_nhap_luc = CASE WHEN excluded.gia_nhap IS NOT gia_nhap THEN excluded.gia_nhap_luc ELSE gia_nhap_luc END,
       gia_nhap = excluded.gia_nhap, nguoi_cap_nhat = excluded.nguoi_cap_nhat, ngay_cap_nhat = excluded.ngay_cap_nhat`,
  )
    .bind(ma, chuoi(b.ten), chuoi(b.phan_loai), chuoi(b.nganh), chuoi(b.noi_san_xuat), soHoacNull(b.he_so_du_tru), soHoacNull(b.leadtime), chuoi(b.doi_tac), chuoi(b.nhom_tuong_duong), gia, c.get("user").email, luc)
    .run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- Phan loai LK + he so thu hoi
caiDat.get("/phan-loai", async (c) => {
  const [pl, mt] = await Promise.all([
    c.env.DB.prepare("SELECT ten, he_so_thu_hoi, stt FROM phan_loai_lk ORDER BY stt, ten").all(),
    c.env.DB.prepare("SELECT phan_loai, nhom, danh_gia FROM ma_tran_thu_hoi").all(),
  ]);
  return c.json({ phan_loai: pl.results, ma_tran: mt.results });
});

// Ghi lai TOAN BO danh sach phan loai + ma tran (form nho, it dong). Doi ten phan loai: gui ten_cu de chuyen khai bao LK theo.
caiDat.put("/phan-loai", ghi, async (c) => {
  const b = await c.req.json<{
    phan_loai: { ten: string; ten_cu?: string; he_so_thu_hoi: number; stt?: number }[];
    ma_tran: { phan_loai: string; nhom: string; danh_gia: string }[];
  }>();
  const pl = (b.phan_loai ?? []).map((p, i) => ({ ten: chuoi(p.ten), ten_cu: chuoi(p.ten_cu), he_so: soHoacNull(p.he_so_thu_hoi) ?? 0, stt: i })).filter((p) => p.ten);
  if (new Set(pl.map((p) => p.ten)).size !== pl.length) return c.json({ error: "TRUNG_TEN" }, 400);
  const mt = (b.ma_tran ?? []).filter((m) => chuoi(m.phan_loai) && ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"].includes(m.nhom) && chuoi(m.danh_gia));
  const db = c.env.DB;
  await db.batch([
    ...pl.filter((p) => p.ten_cu && p.ten_cu !== p.ten).map((p) => db.prepare("UPDATE lk_khai_bao SET phan_loai = ? WHERE phan_loai = ?").bind(p.ten, p.ten_cu)),
    db.prepare("DELETE FROM phan_loai_lk"),
    db.prepare("INSERT INTO phan_loai_lk (ten, he_so_thu_hoi, stt) SELECT json_extract(value, '$.ten'), json_extract(value, '$.he_so'), json_extract(value, '$.stt') FROM json_each(?)").bind(JSON.stringify(pl)),
    db.prepare("DELETE FROM ma_tran_thu_hoi"),
    db.prepare(
      "INSERT INTO ma_tran_thu_hoi (phan_loai, nhom, danh_gia) SELECT json_extract(value, '$.phan_loai'), json_extract(value, '$.nhom'), json_extract(value, '$.danh_gia') FROM json_each(?)",
    ).bind(JSON.stringify(mt.map((m) => ({ phan_loai: m.phan_loai.trim(), nhom: m.nhom, danh_gia: m.danh_gia.trim() })))),
  ]);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- Kho
caiDat.get("/kho", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM kho ORDER BY loai, ten").all();
  return c.json({ rows: results.map((r) => ({ ...r, ten_khac: JSON.parse(String(r.ten_khac ?? "[]")) })) });
});

// Sua loai kho, ten khac (khop file xuat thang tinh), thong tin KTV nhap tay (null = theo dong bo).
caiDat.put("/kho/:ma", ghi, async (c) => {
  const ma = c.req.param("ma") ?? "";
  const b = await c.req.json<{ ten?: string; loai?: string; ten_khac?: string[]; lam_viec_tay?: number | null; phong_ban_tay?: string | null; khu_vuc_tay?: string | null }>();
  if (b.loai && !["cong_ty", "ktv", "khac", "bo_qua"].includes(b.loai)) return c.json({ error: "INVALID_LOAI" }, 400);
  const tenKhac = Array.isArray(b.ten_khac) ? JSON.stringify([...new Set(b.ten_khac.map((t) => String(t).trim()).filter(Boolean))]) : null;
  const lamViec = b.lam_viec_tay === undefined ? undefined : b.lam_viec_tay === null ? null : b.lam_viec_tay ? 1 : 0;
  const r = await c.env.DB.prepare(
    `INSERT INTO kho (ma, ten, loai, ten_khac, nguon, lam_viec_tay, phong_ban_tay, khu_vuc_tay, ngay_cap_nhat)
     VALUES (?1, COALESCE(?2, ?1), COALESCE(?3, 'khac'), COALESCE(?4, '[]'), 'tu_khai_bao', ?5, ?6, ?7, ?8)
     ON CONFLICT(ma) DO UPDATE SET ten = COALESCE(?2, ten), loai = COALESCE(?3, loai), ten_khac = COALESCE(?4, ten_khac),
       lam_viec_tay = CASE WHEN ?9 THEN ?5 ELSE lam_viec_tay END,
       phong_ban_tay = CASE WHEN ?10 THEN ?6 ELSE phong_ban_tay END,
       khu_vuc_tay = CASE WHEN ?11 THEN ?7 ELSE khu_vuc_tay END,
       ngay_cap_nhat = ?8`,
  )
    .bind(
      ma, chuoi(b.ten), b.loai ?? null, tenKhac, lamViec ?? null, chuoi(b.phong_ban_tay), chuoi(b.khu_vuc_tay), nowVN(),
      lamViec !== undefined ? 1 : 0, b.phong_ban_tay !== undefined ? 1 : 0, b.khu_vuc_tay !== undefined ? 1 : 0,
    )
    .run();
  return c.json({ ok: !!r.meta.changes });
});

// Import thong tin kho KTV (Sheet '4.3. Cài đặt kho'): khop theo ma, roi ten / ten_khac (khong phan biet hoa thuong).
// Chi ghi cot *_tay; dong khong khop tra lai de nguoi dung xu ly (khong tu tao kho).
caiDat.post("/kho/import", ghi, async (c) => {
  const b = await c.req.json<{ rows: { ma?: string; ten?: string; lam_viec?: string; phong_ban?: string; khu_vuc?: string }[] }>();
  const db = c.env.DB;
  const { results: dsKho } = await db.prepare("SELECT ma, ten, ten_khac FROM kho").all<{ ma: string; ten: string; ten_khac: string }>();
  const chuan = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const theoTen = new Map<string, string>();
  for (const k of dsKho) {
    theoTen.set(chuan(k.ten), k.ma);
    for (const t of JSON.parse(k.ten_khac || "[]") as string[]) theoTen.set(chuan(t), k.ma);
  }
  const maCo = new Set(dsKho.map((k) => k.ma));
  const khongKhop: string[] = [];
  const lenh: D1PreparedStatement[] = [];
  const luc = nowVN();
  for (const r of (b.rows ?? []).slice(0, 5000)) {
    const ma = r.ma && maCo.has(r.ma.trim()) ? r.ma.trim() : r.ten ? theoTen.get(chuan(r.ten)) : undefined;
    if (!ma) {
      khongKhop.push(r.ma || r.ten || "");
      continue;
    }
    const lv = chuoi(r.lam_viec);
    lenh.push(
      db.prepare("UPDATE kho SET lam_viec_tay = COALESCE(?, lam_viec_tay), phong_ban_tay = COALESCE(?, phong_ban_tay), khu_vuc_tay = COALESCE(?, khu_vuc_tay), ngay_cap_nhat = ? WHERE ma = ?")
        .bind(lv == null ? null : /^l[aà]m$/i.test(lv) ? 1 : 0, chuoi(r.phong_ban), chuoi(r.khu_vuc), luc, ma),
    );
  }
  for (let i = 0; i < lenh.length; i += 100) await db.batch(lenh.slice(i, i + 100));
  return c.json({ ok: true, da_cap_nhat: lenh.length, khong_khop: khongKhop });
});

export default caiDat;
