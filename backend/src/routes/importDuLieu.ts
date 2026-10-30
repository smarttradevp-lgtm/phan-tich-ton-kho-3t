import { Hono } from "hono";
import type { AppEnv } from "../types";
import { canVaiTro } from "../middleware/session";
import { nowVN } from "../lib/vnTime";
import { baoPhienTonMoi } from "../lib/khoMisa";

// Import du lieu tu file (trinh duyet doc Excel MISA, gui JSON theo LO <= 1000 dong). Moi import nhieu lo dung bang tam
// + lo cuoi thay du lieu that trong 1 batch -> dung giua chung khong mat du lieu cu, import lai khong cong trung.
const imp = new Hono<AppEnv>();
imp.use("*", canVaiTro("nhap_lieu"));

const MAX_DONG_LO = 1000;
const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const THANG_RE = /^\d{6}$/;
const LO_RE = /^[A-Za-z0-9_-]{8,64}$/;

type Body<T> = { lo: string; rows: T[]; dau?: boolean; cuoi?: { ten_file?: string } };

const so = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const chuoi = (v: unknown) => (v == null ? null : String(v).trim() || null);

// ---------------------------------------------------------------- So chi tiet vat tu (hang ngay, file 30 ngay)
interface SctRow {
  ma_kho: string; ten_kho?: string; ma_hang: string; ten_hang?: string; ngay_hach_toan: string; ngay_chung_tu?: string;
  so_chung_tu?: string; dvt?: string; dien_giai?: string; sl_nhap?: number; sl_xuat?: number; tk_doi_ung?: string;
  tk_kho?: string; sl_ton?: number | null; ma_phe_duyet?: string;
}

imp.post("/so-chi-tiet", async (c) => {
  const body = await c.req.json<Body<SctRow>>();
  if (!LO_RE.test(body.lo ?? "")) return c.json({ error: "INVALID_LO" }, 400);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length > MAX_DONG_LO) return c.json({ error: "QUA_NHIEU_DONG", toi_da: MAX_DONG_LO }, 400);
  const loi: { dong: number; loi: string }[] = [];
  const sach = rows.flatMap((r, i) => {
    const ma_kho = chuoi(r.ma_kho), ma_hang = chuoi(r.ma_hang), ngay = chuoi(r.ngay_hach_toan);
    if (!ma_kho || !ma_hang) return loi.push({ dong: i, loi: "THIEU_MA" }), [];
    if (!ngay || !NGAY_RE.test(ngay)) return loi.push({ dong: i, loi: "NGAY_KHONG_HOP_LE" }), [];
    return [{
      ma_kho, ten_kho: chuoi(r.ten_kho), ma_hang, ten_hang: chuoi(r.ten_hang), ngay_hach_toan: ngay,
      ngay_chung_tu: chuoi(r.ngay_chung_tu), so_chung_tu: chuoi(r.so_chung_tu), dvt: chuoi(r.dvt), dien_giai: chuoi(r.dien_giai),
      sl_nhap: so(r.sl_nhap), sl_xuat: so(r.sl_xuat), tk_doi_ung: chuoi(r.tk_doi_ung),
      tk_kho: chuoi(r.tk_kho), sl_ton: r.sl_ton == null ? null : so(r.sl_ton), ma_phe_duyet: chuoi(r.ma_phe_duyet),
    }];
  });
  if (loi.length) return c.json({ error: "DONG_LOI", loi: loi.slice(0, 50) }, 400);

  const db = c.env.DB;
  const lenh: D1PreparedStatement[] = [];
  if (body.dau) lenh.push(db.prepare("DELETE FROM so_chi_tiet_tam"));
  if (sach.length) {
    lenh.push(
      db.prepare(
        `INSERT INTO so_chi_tiet_tam (lo, ma_kho, ten_kho, ma_hang, ten_hang, ngay_hach_toan, ngay_chung_tu, so_chung_tu, dvt, dien_giai, sl_nhap, sl_xuat, tk_doi_ung, tk_kho, sl_ton, ma_phe_duyet)
         SELECT ?, json_extract(value, '$.ma_kho'), json_extract(value, '$.ten_kho'), json_extract(value, '$.ma_hang'), json_extract(value, '$.ten_hang'), json_extract(value, '$.ngay_hach_toan'), json_extract(value, '$.ngay_chung_tu'),
                json_extract(value, '$.so_chung_tu'), json_extract(value, '$.dvt'), json_extract(value, '$.dien_giai'), json_extract(value, '$.sl_nhap'), json_extract(value, '$.sl_xuat'), json_extract(value, '$.tk_doi_ung'),
                json_extract(value, '$.tk_kho'), json_extract(value, '$.sl_ton'), json_extract(value, '$.ma_phe_duyet')
         FROM json_each(?)`,
      ).bind(body.lo, JSON.stringify(sach)),
    );
  }
  if (lenh.length) await db.batch(lenh);
  if (!body.cuoi) return c.json({ ok: true, da_nhan: sach.length });

  // Lo cuoi: thay so_chi_tiet trong [tu_ngay, den_ngay] cua cac kho co trong file.
  const pv = await db.prepare("SELECT MIN(ngay_hach_toan) AS tu, MAX(ngay_hach_toan) AS den, COUNT(*) AS n FROM so_chi_tiet_tam WHERE lo = ?")
    .bind(body.lo)
    .first<{ tu: string | null; den: string | null; n: number }>();
  if (!pv?.n) return c.json({ error: "FILE_RONG" }, 400);
  const luc = nowVN();
  const ketQua = await db.batch([
    db.prepare("INSERT INTO import_log (loai, ten_file, nguoi, luc, so_dong, tu_ngay, den_ngay) VALUES ('so_chi_tiet', ?, ?, ?, ?, ?, ?)")
      .bind(chuoi(body.cuoi.ten_file), c.get("user").email, luc, pv.n, pv.tu, pv.den),
    db.prepare(
      `DELETE FROM so_chi_tiet WHERE ngay_hach_toan BETWEEN ? AND ?
         AND ma_kho IN (SELECT DISTINCT ma_kho FROM so_chi_tiet_tam WHERE lo = ?)`,
    ).bind(pv.tu, pv.den, body.lo),
    db.prepare(
      `INSERT INTO so_chi_tiet (ma_kho, ten_kho, ma_hang, ten_hang, ngay_hach_toan, ngay_chung_tu, so_chung_tu, dvt, dien_giai, sl_nhap, sl_xuat, tk_doi_ung, tk_kho, sl_ton, ma_phe_duyet, import_id)
       SELECT ma_kho, ten_kho, ma_hang, ten_hang, ngay_hach_toan, ngay_chung_tu, so_chung_tu, dvt, dien_giai, sl_nhap, sl_xuat, tk_doi_ung, tk_kho, sl_ton, ma_phe_duyet,
              (SELECT MAX(id) FROM import_log)
       FROM so_chi_tiet_tam WHERE lo = ?`,
    ).bind(body.lo),
    // Kho moi gap lan dau -> them vao danh muc kho (loai 'khac', nhan su chon lai loai o Cai dat).
    db.prepare(
      `INSERT OR IGNORE INTO kho (ma, ten, loai, nguon) SELECT ma_kho, MAX(COALESCE(ten_kho, ma_kho)), 'khac', 'import'
       FROM so_chi_tiet_tam WHERE lo = ? GROUP BY ma_kho`,
    ).bind(body.lo),
    db.prepare("DELETE FROM so_chi_tiet_tam"),
  ]);
  return c.json({ ok: true, so_dong: pv.n, tu_ngay: pv.tu, den_ngay: pv.den, da_xoa_cu: ketQua[1].meta.changes });
});

// ---------------------------------------------------------------- Xuat theo thang (file tinh thang cu)
// FE da quy ten kho -> ma kho (khop kho.ten / kho.ten_khac). Moi thang co trong file THAY toan bo thang do.
interface XtRow { thang: string; ma_kho: string; ma_hang: string; ten_hang?: string; sl_xuat: number }

imp.post("/xuat-thang", async (c) => {
  const body = await c.req.json<Body<XtRow>>();
  if (!LO_RE.test(body.lo ?? "")) return c.json({ error: "INVALID_LO" }, 400);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length > MAX_DONG_LO) return c.json({ error: "QUA_NHIEU_DONG", toi_da: MAX_DONG_LO }, 400);
  const loi: { dong: number; loi: string }[] = [];
  const sach = rows.flatMap((r, i) => {
    const thang = chuoi(r.thang), ma_kho = chuoi(r.ma_kho), ma_hang = chuoi(r.ma_hang);
    if (!thang || !THANG_RE.test(thang)) return loi.push({ dong: i, loi: "THANG_KHONG_HOP_LE" }), [];
    if (!ma_kho || !ma_hang) return loi.push({ dong: i, loi: "THIEU_MA" }), [];
    return [{ thang, ma_kho, ma_hang, ten_hang: chuoi(r.ten_hang), sl_xuat: so(r.sl_xuat) }];
  });
  if (loi.length) return c.json({ error: "DONG_LOI", loi: loi.slice(0, 50) }, 400);
  const db = c.env.DB;
  const lenh: D1PreparedStatement[] = [];
  if (body.dau) lenh.push(db.prepare("DELETE FROM xuat_thang_tam"));
  if (sach.length) {
    lenh.push(
      db.prepare(
        `INSERT INTO xuat_thang_tam (lo, thang, ma_kho, ma_hang, ten_hang, sl_xuat)
         SELECT ?, json_extract(value, '$.thang'), json_extract(value, '$.ma_kho'), json_extract(value, '$.ma_hang'), json_extract(value, '$.ten_hang'), json_extract(value, '$.sl_xuat') FROM json_each(?)`,
      ).bind(body.lo, JSON.stringify(sach)),
    );
  }
  if (lenh.length) await db.batch(lenh);
  if (!body.cuoi) return c.json({ ok: true, da_nhan: sach.length });

  const pv = await db.prepare("SELECT MIN(thang) AS tu, MAX(thang) AS den, COUNT(*) AS n FROM xuat_thang_tam WHERE lo = ?")
    .bind(body.lo)
    .first<{ tu: string | null; den: string | null; n: number }>();
  if (!pv?.n) return c.json({ error: "FILE_RONG" }, 400);
  const luc = nowVN();
  await db.batch([
    db.prepare("DELETE FROM xuat_thang WHERE thang IN (SELECT DISTINCT thang FROM xuat_thang_tam WHERE lo = ?)").bind(body.lo),
    db.prepare(
      `INSERT INTO xuat_thang (thang, ma_kho, ma_hang, ten_hang, sl_xuat, nguon, ngay_ghi)
       SELECT thang, ma_kho, ma_hang, MAX(ten_hang), SUM(sl_xuat), 'import', ? FROM xuat_thang_tam WHERE lo = ? GROUP BY thang, ma_kho, ma_hang`,
    ).bind(luc, body.lo),
    db.prepare("INSERT INTO import_log (loai, ten_file, nguoi, luc, so_dong, tu_ngay, den_ngay) VALUES ('xuat_thang', ?, ?, ?, ?, ?, ?)")
      .bind(chuoi(body.cuoi.ten_file), c.get("user").email, luc, pv.n, pv.tu, pv.den),
    db.prepare("DELETE FROM xuat_thang_tam"),
  ]);
  return c.json({ ok: true, so_dong: pv.n, tu_thang: pv.tu, den_thang: pv.den });
});

// ---------------------------------------------------------------- Khai bao LK (gom ca gia nhap)
// O trong / khong gui = GIU gia tri cu (ON CONFLICT ... COALESCE). 1 request = 1 lo, khong can bang tam.
interface KbRow {
  ma: string; ten?: string; phan_loai?: string; nganh?: string; noi_san_xuat?: string; he_so_du_tru?: number | string;
  leadtime?: number | string; doi_tac?: string; nhom_tuong_duong?: string; gia_nhap?: number | string;
}

const soHoacNull = (v: unknown) => {
  if (v == null || (typeof v === "string" && v.trim() === "")) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

imp.post("/khai-bao-lk", async (c) => {
  const body = await c.req.json<{ rows: KbRow[]; ten_file?: string; nguon_gia?: "import" | "drive" }>();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length > MAX_DONG_LO) return c.json({ error: "QUA_NHIEU_DONG", toi_da: MAX_DONG_LO }, 400);
  const sach = rows
    .map((r) => ({
      ma: chuoi(r.ma),
      ten: chuoi(r.ten),
      phan_loai: chuoi(r.phan_loai),
      nganh: chuoi(r.nganh),
      noi_san_xuat: chuoi(r.noi_san_xuat),
      he_so_du_tru: soHoacNull(r.he_so_du_tru),
      leadtime: soHoacNull(r.leadtime),
      doi_tac: chuoi(r.doi_tac),
      nhom_tuong_duong: chuoi(r.nhom_tuong_duong),
      gia_nhap: soHoacNull(r.gia_nhap),
    }))
    .filter((r) => r.ma);
  if (!sach.length) return c.json({ error: "FILE_RONG" }, 400);
  const luc = nowVN();
  const email = c.get("user").email;
  const nguonGia = body.nguon_gia === "drive" ? "drive" : "import";
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO lk_khai_bao (ma, ten, phan_loai, nganh, noi_san_xuat, he_so_du_tru, leadtime, doi_tac, nhom_tuong_duong, gia_nhap,
                                gia_nhap_nguon, gia_nhap_luc, nguoi_cap_nhat, ngay_cap_nhat)
       SELECT json_extract(value, '$.ma'), json_extract(value, '$.ten'), json_extract(value, '$.phan_loai'), json_extract(value, '$.nganh'), json_extract(value, '$.noi_san_xuat'), json_extract(value, '$.he_so_du_tru'), json_extract(value, '$.leadtime'),
              json_extract(value, '$.doi_tac'), json_extract(value, '$.nhom_tuong_duong'), json_extract(value, '$.gia_nhap'),
              CASE WHEN json_extract(value, '$.gia_nhap') IS NOT NULL THEN ?1 END, CASE WHEN json_extract(value, '$.gia_nhap') IS NOT NULL THEN ?2 END, ?3, ?2
       FROM json_each(?4) WHERE true
       ON CONFLICT(ma) DO UPDATE SET
         ten = COALESCE(excluded.ten, ten), phan_loai = COALESCE(excluded.phan_loai, phan_loai), nganh = COALESCE(excluded.nganh, nganh),
         noi_san_xuat = COALESCE(excluded.noi_san_xuat, noi_san_xuat), he_so_du_tru = COALESCE(excluded.he_so_du_tru, he_so_du_tru),
         leadtime = COALESCE(excluded.leadtime, leadtime), doi_tac = COALESCE(excluded.doi_tac, doi_tac),
         nhom_tuong_duong = COALESCE(excluded.nhom_tuong_duong, nhom_tuong_duong), gia_nhap = COALESCE(excluded.gia_nhap, gia_nhap),
         gia_nhap_nguon = COALESCE(excluded.gia_nhap_nguon, gia_nhap_nguon), gia_nhap_luc = COALESCE(excluded.gia_nhap_luc, gia_nhap_luc),
         nguoi_cap_nhat = excluded.nguoi_cap_nhat, ngay_cap_nhat = excluded.ngay_cap_nhat`,
    ).bind(nguonGia, luc, email, JSON.stringify(sach)),
    c.env.DB.prepare("INSERT INTO import_log (loai, ten_file, nguoi, luc, so_dong) VALUES ('khai_bao_lk', ?, ?, ?, ?)").bind(chuoi(body.ten_file), email, luc, sach.length),
  ]);
  return c.json({ ok: true, so_dong: sach.length });
});

// ---------------------------------------------------------------- Ton kho tu file Excel (MISA "Tong hop ton kho")
// Thay the tam thoi khi chua co API linh-kien-app: moi file = 1 phien ton_kho_phien nguon 'import'. Lo dau tao phien
// 'dang_keo', cac lo ghi thang vao ton_kho (phien chua 'xong' nen bao cao chua dung), lo cuoi danh dau 'xong'.
// Kho loai 'ktv' -> dong nguon 'ktv' (bao cao thu hoi), con lai 'kho'. Ma kho chua co -> them vao danh muc kho loai 'khac'.
interface TonRow { ma_kho: string; ten_kho?: string; ma_hang: string; ten_hang?: string; dvt?: string; dau_ky?: number; nhap_kho?: number; xuat_kho?: number; cuoi_ky?: number }

imp.post("/ton-kho", async (c) => {
  const body = await c.req.json<Body<TonRow> & { cuoi?: { ten_file?: string; ky_tu_ngay?: string; ky_den_ngay?: string } }>();
  if (!LO_RE.test(body.lo ?? "")) return c.json({ error: "INVALID_LO" }, 400);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length > MAX_DONG_LO) return c.json({ error: "QUA_NHIEU_DONG", toi_da: MAX_DONG_LO }, 400);
  const loi: { dong: number; loi: string }[] = [];
  const sach = rows.flatMap((r, i) => {
    const ma_kho = chuoi(r.ma_kho), ma_hang = chuoi(r.ma_hang);
    if (!ma_kho || !ma_hang) return loi.push({ dong: i, loi: "THIEU_MA" }), [];
    return [{ ma_kho, ten_kho: chuoi(r.ten_kho), ma_hang, ten_hang: chuoi(r.ten_hang), dvt: chuoi(r.dvt), dau_ky: so(r.dau_ky), nhap_kho: so(r.nhap_kho), xuat_kho: so(r.xuat_kho), cuoi_ky: so(r.cuoi_ky) }];
  });
  if (loi.length) return c.json({ error: "DONG_LOI", loi: loi.slice(0, 50) }, 400);

  const db = c.env.DB;
  const phienBan = `import-${body.lo}`;
  const email = c.get("user").email;
  if (body.dau) {
    await db.batch([
      // Phien import do dang (tab bi dong giua chung) -> xoa.
      db.prepare("DELETE FROM ton_kho WHERE phien_id IN (SELECT id FROM ton_kho_phien WHERE nguon = 'import' AND trang_thai = 'dang_keo')"),
      db.prepare("DELETE FROM ton_kho_phien WHERE nguon = 'import' AND trang_thai = 'dang_keo'"),
      db.prepare("INSERT INTO ton_kho_phien (phien_ban, nguon, nguoi, bat_dau_luc) VALUES (?, 'import', ?, ?)").bind(phienBan, email, nowVN()),
    ]);
  }
  const phienId = await db.prepare("SELECT id FROM ton_kho_phien WHERE phien_ban = ? AND trang_thai = 'dang_keo'").bind(phienBan).first<number>("id");
  if (!phienId) return c.json({ error: "PHIEN_KHONG_TON_TAI" }, 400);
  if (sach.length) {
    await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO kho (ma, ten, loai, nguon)
         SELECT json_extract(value, '$.ma_kho'), MAX(COALESCE(json_extract(value, '$.ten_kho'), json_extract(value, '$.ma_kho'))), 'khac', 'import'
         FROM json_each(?) GROUP BY json_extract(value, '$.ma_kho')`,
      ).bind(JSON.stringify(sach)),
      db.prepare(
        `INSERT INTO ton_kho (phien_id, nguon, ma_kho, ma_ktv, ma_hang, ten_hang, ten_kho, dvt, dau_ky, nhap_kho, xuat_kho, cuoi_ky)
         SELECT ?1, CASE WHEN k.loai = 'ktv' THEN 'ktv' ELSE 'kho' END, j.ma_kho, k.ma_ktv, j.ma_hang, j.ten_hang, j.ten_kho, j.dvt, j.dau_ky, j.nhap_kho, j.xuat_kho, j.cuoi_ky
         FROM (SELECT json_extract(value, '$.ma_kho') AS ma_kho, json_extract(value, '$.ma_hang') AS ma_hang, json_extract(value, '$.ten_hang') AS ten_hang,
                      json_extract(value, '$.ten_kho') AS ten_kho, json_extract(value, '$.dvt') AS dvt,
                      json_extract(value, '$.dau_ky') AS dau_ky, json_extract(value, '$.nhap_kho') AS nhap_kho, json_extract(value, '$.xuat_kho') AS xuat_kho,
                      json_extract(value, '$.cuoi_ky') AS cuoi_ky FROM json_each(?2)) j
         LEFT JOIN kho k ON k.ma = j.ma_kho
         WHERE true
         ON CONFLICT(phien_id, nguon, ma_kho, ma_hang) DO UPDATE SET dau_ky = dau_ky + excluded.dau_ky, nhap_kho = nhap_kho + excluded.nhap_kho,
           xuat_kho = xuat_kho + excluded.xuat_kho, cuoi_ky = cuoi_ky + excluded.cuoi_ky`,
      ).bind(phienId, JSON.stringify(sach)),
    ]);
  }
  if (!body.cuoi) return c.json({ ok: true, da_nhan: sach.length });

  const tu = chuoi(body.cuoi.ky_tu_ngay), den = chuoi(body.cuoi.ky_den_ngay);
  if ((tu && !NGAY_RE.test(tu)) || (den && !NGAY_RE.test(den))) return c.json({ error: "NGAY_KHONG_HOP_LE" }, 400);
  const dem = await db.prepare("SELECT SUM(nguon = 'kho') AS kho, SUM(nguon = 'ktv') AS ktv, COUNT(*) AS n FROM ton_kho WHERE phien_id = ?").bind(phienId).first<{ kho: number; ktv: number; n: number }>();
  if (!dem?.n) return c.json({ error: "FILE_RONG" }, 400);
  const luc = nowVN();
  await db.batch([
    db.prepare("UPDATE ton_kho_phien SET trang_thai = 'xong', ky_tu_ngay = ?, ky_den_ngay = ?, so_dong_kho = ?, so_dong_ktv = ?, xong_luc = ?, ten_file = ? WHERE id = ?")
      .bind(tu, den, dem.kho ?? 0, dem.ktv ?? 0, luc, chuoi(body.cuoi.ten_file), phienId),
    db.prepare("INSERT INTO import_log (loai, ten_file, nguoi, luc, so_dong, tu_ngay, den_ngay, ghi_chu) VALUES ('ton_kho', ?, ?, ?, ?, ?, ?, ?)")
      .bind(chuoi(body.cuoi.ten_file), email, luc, dem.n, tu, den, `Kho công ty / khác: ${dem.kho ?? 0} dòng · Kho KTV: ${dem.ktv ?? 0} dòng`),
  ]);
  // Bao linh-kien-app keo phien moi ngay (khong cho cron).
  c.executionCtx.waitUntil(baoPhienTonMoi(c.env, luc).catch((e) => console.error("[baoPhienTonMoi]", e)));
  return c.json({ ok: true, so_dong: dem.n, so_dong_kho: dem.kho ?? 0, so_dong_ktv: dem.ktv ?? 0 });
});

// ---------------------------------------------------------------- Trang thai cac ben keo du lieu MISA (man Nhap du lieu)
imp.get("/trang-thai-doi-tac", async (c) => {
  const db = c.env.DB;
  const [phien, khoa, bao] = await Promise.all([
    db.prepare("SELECT xong_luc FROM ton_kho_phien WHERE trang_thai = 'xong' AND nguon = 'import' ORDER BY id DESC LIMIT 1").first<string>("xong_luc"),
    db.prepare("SELECT ten, quyen, bat_tat, dung_cuoi_luc, phien_ton_da_keo, phien_ton_keo_luc FROM doi_tac_api_key ORDER BY ten").all(),
    db.prepare("SELECT value, updated_at FROM app_settings WHERE key = 'thong_bao_phien_ton'").first<{ value: string; updated_at: string }>(),
  ]);
  return c.json({ phien_ton_moi_nhat: phien ?? null, doi_tac: khoa.results, thong_bao: bao ? { ...JSON.parse(bao.value), luc: bao.updated_at } : null });
});

// ---------------------------------------------------------------- Lich su import + moc du lieu
imp.get("/lich-su", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM import_log ORDER BY id DESC LIMIT 100").all();
  return c.json({ rows: results });
});

export default imp;
