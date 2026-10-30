import { Hono, type Context, type Next } from "hono";
import type { Env } from "../types";
import { bamKhoa, type TapDuLieu } from "../lib/khoaApi";
import { docXuatThang } from "../lib/duLieuBaoCao";
import { nowVN } from "../lib/vnTime";

// API doi tac - app nay la KHO DU LIEU MISA GOC (docs/KE_HOACH_KHO_MISA.md, tai lieu goi: docs/API_DOI_TAC_MISA.md).
// Chi GET, xac thuc header X-API-Key (bang doi_tac_api_key). Ben keo giu ban sao, chi keo lai khi phien ban doi.
type DtEnv = { Bindings: Env; Variables: { khoaId: number; quyen: string[] } };
const dt = new Hono<DtEnv>();

const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const GIOI_HAN_PHUT = 120;
// Dem tan suat theo isolate (du chan vong lap loi phia doi tac; khong can chinh xac tuyet doi).
const demPhut = new Map<number, { phut: number; n: number }>();

async function xacThuc(c: Context<DtEnv>, next: Next) {
  const khoa = c.req.header("X-API-Key");
  if (!khoa) return c.json({ error: "MISSING_API_KEY" }, 401);
  const r = await c.env.DB.prepare("SELECT id, quyen, bat_tat, dung_cuoi_luc FROM doi_tac_api_key WHERE khoa_bam = ?")
    .bind(await bamKhoa(khoa))
    .first<{ id: number; quyen: string; bat_tat: number; dung_cuoi_luc: string | null }>();
  if (!r || !r.bat_tat) return c.json({ error: "INVALID_API_KEY" }, 401);
  const phut = Math.floor(Date.now() / 60000);
  const d = demPhut.get(r.id);
  if (d && d.phut === phut) {
    if (++d.n > GIOI_HAN_PHUT) return c.json({ error: "TOO_MANY_REQUESTS" }, 429);
  } else demPhut.set(r.id, { phut, n: 1 });
  // "Lan dung cuoi" ghi toi da 1 lan / 10 phut - khong ghi D1 moi request.
  const luc = nowVN();
  if (!r.dung_cuoi_luc || r.dung_cuoi_luc < new Date(Date.now() + 7 * 3600e3 - 600e3).toISOString().slice(0, 19).replace("T", " ")) {
    c.executionCtx.waitUntil(c.env.DB.prepare("UPDATE doi_tac_api_key SET dung_cuoi_luc = ? WHERE id = ?").bind(luc, r.id).run().then(() => undefined));
  }
  c.set("khoaId", r.id);
  c.set("quyen", JSON.parse(r.quyen) as string[]);
  await next();
}

const can = (tap: TapDuLieu) => async (c: Context<DtEnv>, next: Next) => {
  if (!c.get("quyen").includes(tap)) return c.json({ error: "FORBIDDEN_DATASET", tap }, 403);
  await next();
};

dt.use("*", xacThuc);
dt.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

const gioiHan = (v: string | undefined, md: number, max: number) => Math.min(max, Math.max(1, Math.floor(Number(v ?? md)) || md));

// ---------------------------------------------------------------- Ton kho (file "Tổng hợp tồn kho")
// Chi phien NHAP O APP NAY (nguon 'import'); phien keo tu linh-kien-app (giai doan chay song song) khong phat ra.
const PHIEN_SQL = "SELECT id, xong_luc, ky_tu_ngay, ky_den_ngay, ten_file, so_dong_kho + so_dong_ktv AS so_dong FROM ton_kho_phien WHERE trang_thai = 'xong' AND nguon = 'import' ORDER BY id DESC LIMIT 1";
type Phien = { id: number; xong_luc: string; ky_tu_ngay: string | null; ky_den_ngay: string | null; ten_file: string | null; so_dong: number };

dt.get("/v1/misa/ton-kho/meta", can("ton_kho"), async (c) => {
  const p = await c.env.DB.prepare(PHIEN_SQL).first<Phien>();
  return c.json(
    p
      ? { phien_ban: p.xong_luc, ky_tu_ngay: p.ky_tu_ngay, ky_den_ngay: p.ky_den_ngay, so_dong: p.so_dong, ten_file: p.ten_file }
      : { phien_ban: null },
  );
});

// Dong tho dung nhu file, con tro theo id (rowid). phien_ban khac phien moi nhat -> 409 (ben keo bat dau lai).
dt.get("/v1/misa/ton-kho", can("ton_kho"), async (c) => {
  const db = c.env.DB;
  const p = await db.prepare(PHIEN_SQL).first<Phien>();
  if (!p) return c.json({ error: "CHUA_CO_DU_LIEU" }, 404);
  const yeuCau = c.req.query("phien_ban");
  if (yeuCau && yeuCau !== p.xong_luc) return c.json({ error: "PHIEN_BAN_DA_DOI", phien_ban: p.xong_luc }, 409);
  const after = Math.max(0, Math.floor(Number(c.req.query("after") ?? 0)) || 0);
  const limit = gioiHan(c.req.query("limit"), 1000, 2000);
  const { results } = await db
    .prepare(
      `SELECT rowid AS id, ma_kho, ten_kho, ma_hang, ten_hang, dvt, dau_ky, nhap_kho, xuat_kho, cuoi_ky
       FROM ton_kho WHERE phien_id = ? AND rowid > ? ORDER BY rowid LIMIT ?`,
    )
    .bind(p.id, after, limit)
    .all<{ id: number }>();
  const next = results.length === limit ? results[results.length - 1].id : null;
  // Trang cuoi -> ghi nhan ben nay da keo xong phien nay (hien o man Nhap du lieu).
  if (next === null) {
    c.executionCtx.waitUntil(
      db.prepare("UPDATE doi_tac_api_key SET phien_ton_da_keo = ?, phien_ton_keo_luc = ? WHERE id = ? AND phien_ton_da_keo IS NOT ?")
        .bind(p.xong_luc, nowVN(), c.get("khoaId"), p.xong_luc)
        .run()
        .then(() => undefined),
    );
  }
  return c.json({ phien_ban: p.xong_luc, ky_tu_ngay: p.ky_tu_ngay, ky_den_ngay: p.ky_den_ngay, rows: results, next_after: next });
});

// ---------------------------------------------------------------- So chi tiet vat tu
// Import lai 1 khoang ngay THAY TOAN BO dong cua cac kho trong file o khoang do (id doi) -> ben keo dung meta
// (lan import cuoi: khoang ngay + kho) de keo lai dung khoang va thay ban sao cua minh theo khoa tu nhien.
dt.get("/v1/misa/so-chi-tiet/meta", can("so_chi_tiet"), async (c) => {
  const db = c.env.DB;
  const [cuoi, pham] = await Promise.all([
    db.prepare("SELECT id, luc, tu_ngay, den_ngay, so_dong, ten_file FROM import_log WHERE loai = 'so_chi_tiet' ORDER BY id DESC LIMIT 1").first(),
    db.prepare("SELECT MIN(ngay_hach_toan) AS tu, MAX(ngay_hach_toan) AS den, COUNT(*) AS n FROM so_chi_tiet").first(),
  ]);
  return c.json({ lan_import_cuoi: cuoi, du_lieu: pham });
});

dt.get("/v1/misa/so-chi-tiet", can("so_chi_tiet"), async (c) => {
  const q = c.req.query();
  if (!q.tu || !q.den || !NGAY_RE.test(q.tu) || !NGAY_RE.test(q.den)) return c.json({ error: "THIEU_KHOANG_NGAY" }, 400);
  const after = Math.max(0, Math.floor(Number(q.after_id ?? 0)) || 0);
  const limit = gioiHan(q.limit, 1000, 2000);
  const dsMa = (s?: string) => (s ? JSON.stringify(s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 200)) : null);
  const { results } = await c.env.DB.prepare(
    `SELECT id, ma_kho, ten_kho, ma_hang, ten_hang, ngay_hach_toan, ngay_chung_tu, so_chung_tu, dvt, dien_giai,
            sl_nhap, sl_xuat, sl_ton, tk_kho, tk_doi_ung, ma_phe_duyet, import_id
     FROM so_chi_tiet
     WHERE ngay_hach_toan BETWEEN ?1 AND ?2 AND id > ?3
       AND (?4 IS NULL OR ma_kho IN (SELECT value FROM json_each(?4)))
       AND (?5 IS NULL OR ma_hang IN (SELECT value FROM json_each(?5)))
       AND (?6 = 0 OR sl_nhap <> 0)
     ORDER BY id LIMIT ?7`,
  )
    .bind(q.tu, q.den, after, dsMa(q.ma_kho), dsMa(q.ma), q.chi_nhap === "1" ? 1 : 0, limit)
    .all<{ id: number }>();
  return c.json({ rows: results, next_after_id: results.length === limit ? results[results.length - 1].id : null });
});

// ---------------------------------------------------------------- Xuat kho theo thang (tinh + dong tu so chi tiet)
dt.get("/v1/misa/xuat-thang", can("xuat_thang"), async (c) => {
  const thang = (c.req.query("thang") ?? "").split(",").map((t) => t.trim()).filter((t) => /^\d{6}$/.test(t)).slice(0, 24);
  if (!thang.length) return c.json({ error: "THIEU_THANG" }, 400);
  const ma = c.req.query("ma")?.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 200);
  const rows = await docXuatThang(c.env.DB, thang, ma?.length ? ma : undefined);
  const tinh = (await c.env.DB.prepare("SELECT DISTINCT thang FROM xuat_thang WHERE thang IN (SELECT value FROM json_each(?))").bind(JSON.stringify(thang)).all<{ thang: string }>()).results.map((r) => r.thang);
  return c.json({ thang_tinh: tinh, rows });
});

export default dt;
