// Doc du lieu tu D1 -> dau vao cho bo tinh thuan lib/tinhToan/*. Moi bao cao tinh luc doc (khong luu ket qua).
import { docThamSo, type ThamSo } from "./tinhToan/thamSo";
import { dayThang, ngayLui, soNgayGiua } from "./tinhToan/chung";
import { tinhDapChieu, type DapChieuDauVao, type KhaiBaoLk } from "./tinhToan/dapChieu";
import { tinhLeadtime, type LeadtimeDauVao } from "./tinhToan/leadtime";
import { tinhThuHoi, tongHopThuHoi, type ThuHoiDauVao } from "./tinhToan/thuHoi";
import { thangHienTaiVN } from "./vnTime";

export const KHO_KTV_CHUNG = "Kho KTV chung";
export const CHUA_KHAI_BAO = "Chưa khai báo";

export async function docThamSoDb(db: D1Database): Promise<ThamSo> {
  const v = await db.prepare("SELECT value FROM app_settings WHERE key = 'tham_so'").first<string>("value");
  return docThamSo(v ? JSON.parse(v) : null);
}

export interface PhienTon {
  id: number;
  phien_ban: string;
  ky_tu_ngay: string | null;
  ky_den_ngay: string | null;
  xong_luc: string | null;
}

export async function phienTonMoiNhat(db: D1Database): Promise<PhienTon | null> {
  return db
    .prepare("SELECT id, phien_ban, ky_tu_ngay, ky_den_ngay, xong_luc FROM ton_kho_phien WHERE trang_thai = 'xong' ORDER BY id DESC LIMIT 1")
    .first<PhienTon>();
}

interface KhoRow {
  ma: string;
  ten: string;
  loai: "cong_ty" | "ktv" | "khac" | "bo_qua";
  lam_viec: number | null;
  phong_ban: string | null;
  khu_vuc: string | null;
}

// Kho + thong tin hieu luc (gia tri nhap tay THANG gia tri dong bo).
export async function docKho(db: D1Database): Promise<Map<string, KhoRow>> {
  const { results } = await db
    .prepare(
      `SELECT ma, ten, loai, COALESCE(lam_viec_tay, lam_viec) AS lam_viec, COALESCE(phong_ban_tay, phong_ban) AS phong_ban,
              COALESCE(khu_vuc_tay, khu_vuc) AS khu_vuc FROM kho`,
    )
    .all<KhoRow>();
  return new Map(results.map((k) => [k.ma, k]));
}

// Loai kho khi chua co trong bang kho: dong ton tu nguon 'kho' = cong ty, 'ktv' co ma KTV = ktv, con lai khac.
function loaiKho(kho: Map<string, KhoRow>, ma: string, macDinh: KhoRow["loai"] = "khac"): KhoRow["loai"] {
  return kho.get(ma)?.loai ?? macDinh;
}

// Khai bao LK + ten tu danh muc dong bo. Chot 29/10/2026: gia nhap chua co -> gia du phong (linh-kien-app), khong co -> 0;
// gia_nhap_nguon cho biet dang dung gia nao (FE gan nhan).
// Chuan hoa ten phan loai de so khop (khong phan biet hoa/thuong, khoang trang thua).
export const khoaPhanLoai = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

export async function docKhaiBao(db: D1Database): Promise<Map<string, KhaiBaoLk & { leadtime?: number | null; doi_tac?: string | null; nhom_tuong_duong?: string | null }>> {
  // Phan loai khai bao viet khac hoa/thuong (vd "thuộc diện cắt mã") quy ve ten chuan trong phan_loai_lk.
  const tenChuan = new Map(
    (await db.prepare("SELECT ten FROM phan_loai_lk").all<{ ten: string }>()).results.map((p) => [khoaPhanLoai(p.ten), p.ten]),
  );
  const { results } = await db
    .prepare(
      `SELECT m.ma, COALESCE(l.ten, k.ten) AS ten, k.phan_loai, k.nganh, k.noi_san_xuat, k.he_so_du_tru, k.leadtime,
              k.doi_tac, k.nhom_tuong_duong, k.gia_nhap, l.gia_du_phong
       FROM (SELECT ma FROM lk_khai_bao UNION SELECT ma FROM linh_kien) m
       LEFT JOIN lk_khai_bao k ON k.ma = m.ma
       LEFT JOIN linh_kien l ON l.ma = m.ma`,
    )
    .all<{ ma: string; ten: string | null; phan_loai: string | null; nganh: string | null; noi_san_xuat: string | null; he_so_du_tru: number | null; leadtime: number | null; doi_tac: string | null; nhom_tuong_duong: string | null; gia_nhap: number | null; gia_du_phong: number | null }>();
  return new Map(
    results.map((r) => {
      const nguon: "nhap" | "du_phong" | "khong_co" = r.gia_nhap != null ? "nhap" : (r.gia_du_phong ?? 0) > 0 ? "du_phong" : "khong_co";
      return [
        r.ma,
        {
          ten: r.ten,
          phan_loai: r.phan_loai ? tenChuan.get(khoaPhanLoai(r.phan_loai)) ?? r.phan_loai.trim() : null,
          nganh: r.nganh,
          noi_san_xuat: r.noi_san_xuat,
          he_so_du_tru: r.he_so_du_tru,
          leadtime: r.leadtime,
          doi_tac: r.doi_tac,
          nhom_tuong_duong: r.nhom_tuong_duong,
          gia_nhap: nguon === "nhap" ? r.gia_nhap : nguon === "du_phong" ? r.gia_du_phong : 0,
          gia_nhap_nguon: nguon,
        },
      ];
    }),
  );
}

// Xuat theo thang: thang co du lieu tinh (xuat_thang) dung bang tinh; thang khac cong dong tu so_chi_tiet.
export async function docXuatThang(db: D1Database, thang: string[], maHang?: string): Promise<{ thang: string; ma_kho: string; ma_hang: string; ten_hang: string | null; sl: number }[]> {
  const tj = JSON.stringify(thang);
  const tinh = (await db.prepare("SELECT DISTINCT thang FROM xuat_thang WHERE thang IN (SELECT value FROM json_each(?))").bind(tj).all<{ thang: string }>()).results.map((r) => r.thang);
  const dong = thang.filter((t) => !tinh.includes(t));
  const tuNgay = dong.length ? `${[...dong].sort()[0].slice(0, 4)}-${[...dong].sort()[0].slice(4, 6)}-01` : "9999-12-31";
  const { results } = await db
    .prepare(
      `SELECT thang, ma_kho, ma_hang, MAX(ten_hang) AS ten_hang, SUM(sl) AS sl FROM (
         SELECT thang, ma_kho, ma_hang, ten_hang, sl_xuat AS sl FROM xuat_thang WHERE thang IN (SELECT value FROM json_each(?1)) AND (?4 IS NULL OR ma_hang = ?4)
         UNION ALL
         SELECT substr(ngay_hach_toan, 1, 4) || substr(ngay_hach_toan, 6, 2) AS thang, ma_kho, ma_hang, ten_hang, sl_xuat
         FROM so_chi_tiet
         WHERE ngay_hach_toan >= ?2 AND sl_xuat <> 0 AND (?4 IS NULL OR ma_hang = ?4)
           AND substr(ngay_hach_toan, 1, 4) || substr(ngay_hach_toan, 6, 2) IN (SELECT value FROM json_each(?3))
       ) GROUP BY thang, ma_kho, ma_hang`,
    )
    .bind(tj, tuNgay, JSON.stringify(dong), maHang ?? null)
    .all<{ thang: string; ma_kho: string; ma_hang: string; ten_hang: string | null; sl: number }>();
  return results;
}

async function docTon(db: D1Database, phienId: number) {
  return (
    await db
      .prepare("SELECT nguon, ma_kho, ma_ktv, ma_hang, ten_hang, xuat_kho, cuoi_ky FROM ton_kho WHERE phien_id = ?")
      .bind(phienId)
      .all<{ nguon: "kho" | "ktv"; ma_kho: string; ma_ktv: string | null; ma_hang: string; ten_hang: string | null; xuat_kho: number | null; cuoi_ky: number }>()
  ).results;
}

function loaiDongTon(kho: Map<string, KhoRow>, r: { nguon: string; ma_kho: string; ma_ktv: string | null }): KhoRow["loai"] {
  return loaiKho(kho, r.ma_kho, r.nguon === "kho" ? "cong_ty" : r.ma_ktv ? "ktv" : "khac");
}

// ---------------------------------------------------------------- Dap chieu / T5
export type CheDoGop = "tat_ca" | "gop_rieng_ktv" | "gop_khong_ktv" | "gop_chung";

export async function baoCaoDapChieu(db: D1Database, cheDo: CheDoGop) {
  const ts = await docThamSoDb(db);
  const thangN = thangHienTaiVN(); // chot 29/10/2026: thang N = thang hien tai (luy ke)
  const thang = dayThang(thangN, Math.max(12, ts.so_thang_hien_thi));
  const [kho, khaiBao, xuat, phien, mocSct] = await Promise.all([
    docKho(db),
    docKhaiBao(db),
    docXuatThang(db, thang),
    phienTonMoiNhat(db),
    db.prepare("SELECT MAX(ngay_hach_toan) AS d FROM so_chi_tiet").first<string | null>("d"),
  ]);
  const ton = phien ? await docTon(db, phien.id) : [];

  const nhomCua = (maKho: string, loai: KhoRow["loai"]): string | null => {
    if (loai === "bo_qua") return null;
    if (cheDo === "gop_chung") return "Toàn quốc";
    if (loai === "ktv") return cheDo === "gop_khong_ktv" ? null : KHO_KTV_CHUNG;
    return cheDo === "tat_ca" ? kho.get(maKho)?.ten ?? maKho : "Gộp chung";
  };

  const map = new Map<string, DapChieuDauVao>();
  const lay = (nhom: string, ma: string, ten: string | null) => {
    const k = `${nhom}\u0000${ma}`;
    let d = map.get(k);
    if (!d) map.set(k, (d = { nhom, ma, ten: ten ?? "", ton: 0, xuat: new Map() }));
    if (!d.ten && ten) d.ten = ten;
    return d;
  };
  for (const x of xuat) {
    // Xuat: chi tinh kho KHONG phai KTV (Sheet: xuat thang lay tu kho cong ty).
    const loai = loaiKho(kho, x.ma_kho);
    if (loai === "ktv") continue;
    const nhom = nhomCua(x.ma_kho, loai);
    if (!nhom) continue;
    const d = lay(nhom, x.ma_hang, x.ten_hang);
    d.xuat.set(x.thang, (d.xuat.get(x.thang) ?? 0) + x.sl);
  }
  for (const t of ton) {
    if (!t.cuoi_ky) continue;
    const nhom = nhomCua(t.ma_kho, loaiDongTon(kho, t));
    if (!nhom) continue;
    lay(nhom, t.ma_hang, t.ten_hang).ton += t.cuoi_ky;
  }
  const rows = tinhDapChieu(thangN, [...map.values()], khaiBao, ts);
  return {
    thang_n: thangN,
    thang: thang.slice(0, ts.so_thang_hien_thi),
    moc_so_chi_tiet: mocSct,
    moc_ton_kho: phien?.xong_luc ?? null,
    phien_ton_kho: phien?.phien_ban ?? null,
    rows,
  };
}

// ---------------------------------------------------------------- Leadtime
export async function baoCaoLeadtime(db: D1Database, opts: { gop: boolean; loaiKho: "cong_ty" | "ktv" | "tat_ca" }) {
  const ts = await docThamSoDb(db);
  const [d1, d2, d3] = ts.cua_so_ngay;
  const ngayMoc = await db.prepare("SELECT MAX(ngay_hach_toan) AS d FROM so_chi_tiet").first<string | null>("d");
  const [kho, khaiBao, phien, dvbh, dangVe] = await Promise.all([
    docKho(db),
    docKhaiBao(db),
    phienTonMoiNhat(db),
    db.prepare("SELECT ma_hang, so_ca FROM dvbh_thieu_lk").all<{ ma_hang: string; so_ca: number }>(),
    db.prepare("SELECT ma_hang, ma_kho, SUM(so_luong) AS sl FROM hang_dang_ve GROUP BY ma_hang, ma_kho").all<{ ma_hang: string; ma_kho: string | null; sl: number }>(),
  ]);
  const tieuHao = ngayMoc
    ? (
        await db
          .prepare(
            `SELECT ma_kho, ma_hang, MAX(ten_hang) AS ten_hang,
                    SUM(CASE WHEN ngay_hach_toan > ?2 THEN sl_xuat ELSE 0 END) AS t1,
                    SUM(CASE WHEN ngay_hach_toan > ?3 THEN sl_xuat ELSE 0 END) AS t2,
                    SUM(CASE WHEN ngay_hach_toan > ?4 THEN sl_xuat ELSE 0 END) AS t3
             FROM so_chi_tiet WHERE ngay_hach_toan > ?4 AND ngay_hach_toan <= ?1
             GROUP BY ma_kho, ma_hang`,
          )
          .bind(ngayMoc, ngayLui(ngayMoc, d1), ngayLui(ngayMoc, d2), ngayLui(ngayMoc, d3))
          .all<{ ma_kho: string; ma_hang: string; ten_hang: string | null; t1: number; t2: number; t3: number }>()
      ).results
    : [];
  const ton = phien ? await docTon(db, phien.id) : [];

  const hopLe = (loai: KhoRow["loai"]) =>
    loai !== "bo_qua" && (opts.loaiKho === "tat_ca" || (opts.loaiKho === "ktv" ? loai === "ktv" : loai !== "ktv"));
  const tenKho = (ma: string) => (opts.gop ? "Gộp chung" : kho.get(ma)?.ten ?? ma);
  const map = new Map<string, LeadtimeDauVao & { ma_kho: string | null }>();
  const lay = (maKho: string, ma: string, ten: string | null) => {
    const k = `${opts.gop ? "" : maKho}\u0000${ma}`;
    let d = map.get(k);
    if (!d) map.set(k, (d = { kho: tenKho(maKho), ma_kho: opts.gop ? null : maKho, ma, ten: ten ?? "", tieu_hao: [0, 0, 0], ton: 0 }));
    if (!d.ten && ten) d.ten = ten;
    return d;
  };
  for (const t of tieuHao) {
    if (!hopLe(loaiKho(kho, t.ma_kho))) continue;
    const d = lay(t.ma_kho, t.ma_hang, t.ten_hang);
    d.tieu_hao = [d.tieu_hao[0] + t.t1, d.tieu_hao[1] + t.t2, d.tieu_hao[2] + t.t3];
  }
  for (const t of ton) {
    if (!t.cuoi_ky || !hopLe(loaiDongTon(kho, t))) continue;
    lay(t.ma_kho, t.ma_hang, t.ten_hang).ton += t.cuoi_ky;
  }
  const dvbhMap = new Map(dvbh.results.map((r) => [r.ma_hang, r.so_ca]));
  const dauVao = [...map.values()].map((d) => {
    const kb = khaiBao.get(d.ma);
    const ve = dangVe.results.filter((v) => v.ma_hang === d.ma && (d.ma_kho == null || v.ma_kho == null || v.ma_kho === d.ma_kho)).reduce((s, v) => s + v.sl, 0);
    return { ...d, ten: kb?.ten || d.ten, leadtime: kb?.leadtime, he_so_nk: kb?.he_so_du_tru, hang_dang_ve: ve };
  });
  // SL du tru tieu chuan + ton du uoc tinh lay tu bao cao dap chieu (Sheet '0.2' cot Q, R): theo tung kho -> che do "tat_ca"
  // (nhom = ten kho; kho KTV gop "Kho KTV chung" nen dong kho KTV rieng khong co); gop chung -> gop kho cong ty / ca KTV.
  const dc = await baoCaoDapChieu(db, opts.gop ? (opts.loaiKho === "cong_ty" ? "gop_khong_ktv" : "gop_chung") : "tat_ca");
  const dcMap = new Map(dc.rows.map((d) => [opts.gop ? d.ma : `${d.nhom}\u0000${d.ma}`, d]));
  const rows = tinhLeadtime(dauVao, ts).map((r, i) => {
    const kb = khaiBao.get(r.ma);
    const d = dcMap.get(opts.gop ? r.ma : `${r.kho}\u0000${r.ma}`);
    return {
      ...r,
      ma_kho: dauVao[i].ma_kho,
      phan_loai: kb?.phan_loai || CHUA_KHAI_BAO,
      nhom_tuong_duong: kb?.nhom_tuong_duong ?? null,
      doi_tac: kb?.doi_tac ?? null,
      du_tru: d?.du_tru ?? null,
      ton_du: d?.ton_du ?? null,
      dvbh_so_ca: dvbhMap.get(r.ma) ?? 0,
    };
  });
  return {
    ngay_moc: ngayMoc,
    cua_so: ts.cua_so_ngay,
    moc_ton_kho: phien?.xong_luc ?? null,
    rows,
  };
}

// ---------------------------------------------------------------- Thu hoi DVBH
export async function baoCaoThuHoi(db: D1Database) {
  const ts = await docThamSoDb(db);
  const [kho, khaiBao, phien, phanLoai, maTranRows] = await Promise.all([
    docKho(db),
    docKhaiBao(db),
    phienTonMoiNhat(db),
    db.prepare("SELECT ten, he_so_thu_hoi FROM phan_loai_lk").all<{ ten: string; he_so_thu_hoi: number }>(),
    db.prepare("SELECT phan_loai, nhom, danh_gia FROM ma_tran_thu_hoi").all<{ phan_loai: string; nhom: string; danh_gia: string }>(),
  ]);
  const heSo = new Map(phanLoai.results.map((p) => [p.ten, p.he_so_thu_hoi]));
  const maTran = new Map<string, Map<string, string>>();
  for (const m of maTranRows.results) maTran.set(m.phan_loai, (maTran.get(m.phan_loai) ?? new Map()).set(m.nhom, m.danh_gia));
  // So ky 2 tuan = so ngay cua ky xuat trong file ton KTV / 14; khong biet ky -> tham so (Sheet co dinh 12 = 6 thang).
  const soNgay = phien?.ky_tu_ngay && phien.ky_den_ngay ? soNgayGiua(phien.ky_tu_ngay, phien.ky_den_ngay) + 1 : null;
  const soKy2Tuan = soNgay && soNgay > 0 ? soNgay / 14 : ts.so_ky_2_tuan_mac_dinh;

  const ton = phien ? (await docTon(db, phien.id)).filter((t) => loaiDongTon(kho, t) === "ktv") : [];
  const dauVao: (ThuHoiDauVao & { ma_kho: string; phong_ban: string; khu_vuc: string; kho_chua_khai_bao: boolean })[] = ton.map((t) => {
    const k = kho.get(t.ma_kho);
    const kb = khaiBao.get(t.ma_hang);
    const phanLoai = kb?.phan_loai || ts.phan_loai_chua_cai_dat;
    return {
      kho: k?.ten ?? t.ma_kho,
      ma_kho: t.ma_kho,
      ma: t.ma_hang,
      ten: kb?.ten || t.ten_hang || "",
      xuat: t.xuat_kho,
      ton: t.cuoi_ky,
      // Chot 29/10/2026: kho chua khai bao van tinh, coi nhu dang lam.
      lam_viec: k?.lam_viec == null ? true : k.lam_viec === 1,
      phan_loai: phanLoai,
      he_so: heSo.get(phanLoai) ?? 0,
      phong_ban: k?.phong_ban || CHUA_KHAI_BAO,
      khu_vuc: k?.khu_vuc || CHUA_KHAI_BAO,
      kho_chua_khai_bao: !k || (k.lam_viec == null && !k.phong_ban),
    };
  });
  const rows = tinhThuHoi(dauVao, soKy2Tuan, maTran).map((r, i) => ({
    ...r,
    ma_kho: dauVao[i].ma_kho,
    phong_ban: dauVao[i].phong_ban,
    khu_vuc: dauVao[i].khu_vuc,
    kho_chua_khai_bao: dauVao[i].kho_chua_khai_bao,
  }));
  return {
    ky_tu_ngay: phien?.ky_tu_ngay ?? null,
    ky_den_ngay: phien?.ky_den_ngay ?? null,
    so_ky_2_tuan: soKy2Tuan,
    moc_ton_kho: phien?.xong_luc ?? null,
    tong_hop: tongHopThuHoi(rows),
    rows,
  };
}
