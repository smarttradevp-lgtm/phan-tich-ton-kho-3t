// Keo du lieu tu linh-kien-app qua API doi tac (/api/partner/v1/*, header X-API-Key):
//  - ton kho cong ty + KTV (chi khi phien_ban doi - Ke toan import file MISA moi) -> 1 phien moi trong ton_kho_phien
//  - danh muc LK, danh ba kho / KTV (hang ngay)
// API ben linh-kien-app: docs/API_LINH_KIEN_APP.md.
import type { Env } from "../types";
import { nowVN } from "./vnTime";

async function goiLinhKien<T>(env: Env, duongDan: string): Promise<T> {
  if (!env.LINHKIEN_API_KEY) throw new Error("THIEU_LINHKIEN_API_KEY");
  const url = new URL(duongDan, env.LINHKIEN_BASE_URL);
  const req = new Request(url, { headers: { "X-API-Key": env.LINHKIEN_API_KEY } });
  const res = env.LINHKIEN_SERVICE ? await env.LINHKIEN_SERVICE.fetch(req) : await fetch(req);
  if (!res.ok) throw new Error(`LINHKIEN_${res.status} ${duongDan}`);
  return (await res.json()) as T;
}

async function ghiTrangThai(db: D1Database, khoa: string, ketQua: unknown) {
  await db
    .prepare("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(`dong_bo_${khoa}`, JSON.stringify(ketQua), nowVN())
    .run();
}

// ---------------------------------------------------------------- Ton kho
interface TonMeta { phien_ban: string | null; ky_tu_ngay?: string | null; ky_den_ngay?: string | null }
interface TonTrang {
  phien_ban: string | null;
  next_after_id: number | null;
  rows: { ma_kho: string; ma_ktv: string | null; ma_hang: string; ten_hang: string | null; dau_ky?: number | null; nhap_kho?: number | null; xuat_kho?: number | null; cuoi_ky: number | null }[];
}

const TRANG = 2000;

export async function dongBoTonKho(env: Env, epBuoc = false): Promise<{ trang_thai: string; phien_ban?: string | null; so_dong?: number }> {
  const db = env.DB;
  const meta = await goiLinhKien<TonMeta>(env, "/api/partner/v1/ton-kho/meta");
  if (!meta.phien_ban) return { trang_thai: "chua_co_du_lieu" };
  const daCo = await db.prepare("SELECT id, trang_thai FROM ton_kho_phien WHERE phien_ban = ?").bind(meta.phien_ban).first<{ id: number; trang_thai: string }>();
  if (daCo?.trang_thai === "xong" && !epBuoc) return { trang_thai: "khong_doi", phien_ban: meta.phien_ban };
  if (daCo) await db.batch([db.prepare("DELETE FROM ton_kho WHERE phien_id = ?").bind(daCo.id), db.prepare("DELETE FROM ton_kho_phien WHERE id = ?").bind(daCo.id)]);

  const phienId = (
    await db
      .prepare("INSERT INTO ton_kho_phien (phien_ban, ky_tu_ngay, ky_den_ngay, bat_dau_luc) VALUES (?, ?, ?, ?) RETURNING id")
      .bind(meta.phien_ban, meta.ky_tu_ngay ?? null, meta.ky_den_ngay ?? null, nowVN())
      .first<number>("id")
  )!;
  const dem = { kho: 0, ktv: 0 };
  try {
    for (const nguon of ["kho", "ktv"] as const) {
      let after = 0;
      for (;;) {
        const trang = await goiLinhKien<TonTrang>(env, `/api/partner/v1/ton-kho?nguon=${nguon}&after_id=${after}&limit=${TRANG}`);
        // Ke toan import lai giua chung -> bo phien nay, lan cron sau keo lai tu dau.
        if (trang.phien_ban !== meta.phien_ban) throw new Error("PHIEN_BAN_DOI_GIUA_CHUNG");
        const rows = trang.rows.filter((r) => r.ma_kho && r.ma_hang);
        if (rows.length) {
          await db
            .prepare(
              `INSERT OR REPLACE INTO ton_kho (phien_id, nguon, ma_kho, ma_ktv, ma_hang, ten_hang, dau_ky, nhap_kho, xuat_kho, cuoi_ky)
               SELECT ?1, ?2, json_extract(value, '$.ma_kho'), json_extract(value, '$.ma_ktv'), json_extract(value, '$.ma_hang'),
                      json_extract(value, '$.ten_hang'), json_extract(value, '$.dau_ky'), json_extract(value, '$.nhap_kho'),
                      json_extract(value, '$.xuat_kho'), COALESCE(json_extract(value, '$.cuoi_ky'), 0)
               FROM json_each(?3)`,
            )
            .bind(phienId, nguon, JSON.stringify(rows))
            .run();
          dem[nguon] += rows.length;
        }
        if (trang.next_after_id == null) break;
        after = trang.next_after_id;
      }
    }
    await db.batch([
      db.prepare("UPDATE ton_kho_phien SET trang_thai = 'xong', so_dong_kho = ?, so_dong_ktv = ?, xong_luc = ? WHERE id = ?").bind(dem.kho, dem.ktv, nowVN(), phienId),
      // Kho moi gap trong ton kho -> them vao danh muc kho (loai theo nguon).
      db.prepare(
        `INSERT OR IGNORE INTO kho (ma, ten, loai, nguon, ma_ktv)
         SELECT ma_kho, ma_kho, CASE WHEN nguon = 'kho' THEN 'cong_ty' WHEN MAX(ma_ktv) IS NOT NULL THEN 'ktv' ELSE 'khac' END, 'linhkien', MAX(ma_ktv)
         FROM ton_kho WHERE phien_id = ? GROUP BY nguon, ma_kho`,
      ).bind(phienId),
    ]);
  } catch (err) {
    await db.batch([db.prepare("DELETE FROM ton_kho WHERE phien_id = ?").bind(phienId), db.prepare("UPDATE ton_kho_phien SET trang_thai = 'loi' WHERE id = ?").bind(phienId)]);
    throw err;
  }
  return { trang_thai: "xong", phien_ban: meta.phien_ban, so_dong: dem.kho + dem.ktv };
}

// ---------------------------------------------------------------- Danh muc LK
interface LkTrang {
  next_after_ma: string | null;
  rows: { ma_linh_kien: string; ten_linh_kien: string | null; nhom_lk: string | null; phan_loai: string | null; gia_du_phong: number | null; bat_tat: number }[];
}

export async function dongBoDanhMucLk(env: Env): Promise<number> {
  const db = env.DB;
  const luc = nowVN();
  let after = "";
  let tong = 0;
  for (;;) {
    const trang = await goiLinhKien<LkTrang>(env, `/api/partner/v1/linh-kien/danh-sach?after_ma=${encodeURIComponent(after)}&limit=${TRANG}`);
    if (trang.rows.length) {
      await db
        .prepare(
          `INSERT INTO linh_kien (ma, ten, nhom_lk, phan_loai_vat_ly, gia_du_phong, bat_tat, dong_bo_luc)
           SELECT json_extract(value, '$.ma_linh_kien'), json_extract(value, '$.ten_linh_kien'), json_extract(value, '$.nhom_lk'),
                  json_extract(value, '$.phan_loai'), json_extract(value, '$.gia_du_phong'), COALESCE(json_extract(value, '$.bat_tat'), 1), ?1
           FROM json_each(?2) WHERE true
           ON CONFLICT(ma) DO UPDATE SET ten = excluded.ten, nhom_lk = excluded.nhom_lk, phan_loai_vat_ly = excluded.phan_loai_vat_ly,
             gia_du_phong = excluded.gia_du_phong, bat_tat = excluded.bat_tat, dong_bo_luc = excluded.dong_bo_luc`,
        )
        .bind(luc, JSON.stringify(trang.rows))
        .run();
      tong += trang.rows.length;
    }
    if (!trang.next_after_ma) break;
    after = trang.next_after_ma;
  }
  // Ma da bi xoa ben linh-kien-app -> danh dau tat (khong xoa: con du lieu lich su).
  await db.prepare("UPDATE linh_kien SET bat_tat = 0 WHERE dong_bo_luc < ?").bind(luc).run();
  return tong;
}

// ---------------------------------------------------------------- Danh ba kho + KTV
interface DanhBa {
  kho_cong_ty: { ma: string; ten: string; bat_tat: number }[];
  ktv: { ma_ktv: string; ma_misa: string | null; ten: string | null; khu_vuc_ma: string | null; khu_vuc_ten: string | null; dang_lam: number }[];
}

export async function dongBoDanhBa(env: Env): Promise<{ kho: number; ktv: number }> {
  const db = env.DB;
  const ds = await goiLinhKien<DanhBa>(env, "/api/partner/v1/danh-ba-kho");
  const luc = nowVN();
  // Kho KTV dinh danh theo Ma MISA (= ma kho trong file ton kho). KTV chua co Ma MISA thi chua co kho -> bo qua.
  const ktv = ds.ktv.filter((k) => k.ma_misa);
  await db.batch([
    db.prepare(
      `INSERT INTO kho (ma, ten, loai, nguon, ngay_cap_nhat)
       SELECT json_extract(value, '$.ma'), json_extract(value, '$.ten'), 'cong_ty', 'linhkien', ?1 FROM json_each(?2) WHERE true
       ON CONFLICT(ma) DO UPDATE SET ten = excluded.ten, nguon = 'linhkien', ngay_cap_nhat = excluded.ngay_cap_nhat,
         loai = CASE WHEN loai = 'khac' THEN 'cong_ty' ELSE loai END`,
    ).bind(luc, JSON.stringify(ds.kho_cong_ty)),
    db.prepare(
      `INSERT INTO kho (ma, ten, loai, nguon, ma_ktv, lam_viec, khu_vuc, ngay_cap_nhat)
       SELECT json_extract(value, '$.ma_misa'), COALESCE(json_extract(value, '$.ten'), json_extract(value, '$.ma_misa')), 'ktv', 'linhkien',
              json_extract(value, '$.ma_ktv'), json_extract(value, '$.dang_lam'), json_extract(value, '$.khu_vuc_ma'), ?1
       FROM json_each(?2) WHERE true
       ON CONFLICT(ma) DO UPDATE SET ten = excluded.ten, nguon = 'linhkien', ma_ktv = excluded.ma_ktv, lam_viec = excluded.lam_viec,
         khu_vuc = excluded.khu_vuc, ngay_cap_nhat = excluded.ngay_cap_nhat, loai = CASE WHEN loai = 'khac' THEN 'ktv' ELSE loai END`,
    ).bind(luc, JSON.stringify(ktv)),
  ]);
  return { kho: ds.kho_cong_ty.length, ktv: ktv.length };
}

// ---------------------------------------------------------------- Chay tat ca (cron / nut "Dong bo ngay")
export async function chayDongBo(env: Env, phan: { tonKho?: boolean; danhMuc?: boolean; epBuoc?: boolean }) {
  const kq: Record<string, unknown> = { luc: nowVN() };
  if (phan.danhMuc) {
    try {
      kq.danh_ba = await dongBoDanhBa(env);
      kq.danh_muc_lk = await dongBoDanhMucLk(env);
    } catch (e) {
      kq.loi_danh_muc = String(e);
    }
    await ghiTrangThai(env.DB, "danh_muc", kq);
  }
  if (phan.tonKho) {
    try {
      kq.ton_kho = await dongBoTonKho(env, phan.epBuoc);
    } catch (e) {
      kq.loi_ton_kho = String(e);
    }
    await ghiTrangThai(env.DB, "ton_kho", kq);
  }
  return kq;
}
