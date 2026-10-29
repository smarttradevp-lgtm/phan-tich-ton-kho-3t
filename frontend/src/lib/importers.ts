// Doc 4 loai file import -> dong JSON gui backend. Tieu de nhan theo chu bo dau (lib/excel.ts timCot).
import { api } from "./api";
import { boDau, docChuoi, docNgay, docSo, timCot } from "./excel";

const ma = (v: unknown) => docChuoi(typeof v === "number" ? Math.round(v) : v);

// ---------------------------------------------------------------- So chi tiet vat tu (MISA)
export interface SctRow {
  ma_kho: string; ten_kho: string | null; ma_hang: string; ten_hang: string | null; ngay_hach_toan: string; ngay_chung_tu: string | null;
  so_chung_tu: string | null; dvt: string | null; dien_giai: string | null; sl_nhap: number; sl_xuat: number; tk_doi_ung: string | null;
}

export function docSoChiTiet(rows: unknown[][]): { rows: SctRow[]; bo_qua: number } {
  const t = timCot(
    rows,
    {
      ma_kho: ["ma kho"], ten_kho: ["ten kho"], ma_hang: ["ma hang", "ma vat tu", "ma san pham"], ten_hang: ["ten hang", "ten vat tu", "ten san pham"],
      ngay_hach_toan: ["ngay hach toan"], ngay_chung_tu: ["ngay chung tu"], so_chung_tu: ["so chung tu"], dvt: ["dvt", "don vi tinh"],
      dien_giai: ["dien giai"], sl_nhap: ["so luong nhap", "nhap so luong", "sl nhap"], sl_xuat: ["so luong xuat", "xuat so luong", "sl xuat"],
      tk_doi_ung: ["tk doi ung"],
    },
    ["ma_kho", "ma_hang", "ngay_hach_toan", "sl_xuat"],
  );
  if (!t) throw new Error("Không tìm thấy dòng tiêu đề (cần cột Mã kho, Mã hàng, Ngày hạch toán, Số lượng Xuất).");
  const c = t.cot;
  const g = (r: unknown[], k: keyof typeof c) => (c[k] == null ? null : r[c[k]!]);
  let boQua = 0;
  const out: SctRow[] = [];
  for (const r of rows.slice(t.dongDau)) {
    const dg = docChuoi(g(r, "dien_giai"));
    const ngay = docNgay(g(r, "ngay_hach_toan"));
    const mk = ma(g(r, "ma_kho")), mh = ma(g(r, "ma_hang"));
    if (!ngay || !mk || !mh || (dg && boDau(dg).includes("so du dau ky"))) {
      boQua++;
      continue;
    }
    out.push({
      ma_kho: mk, ten_kho: docChuoi(g(r, "ten_kho")), ma_hang: mh, ten_hang: docChuoi(g(r, "ten_hang")), ngay_hach_toan: ngay,
      ngay_chung_tu: docNgay(g(r, "ngay_chung_tu")), so_chung_tu: docChuoi(g(r, "so_chung_tu")), dvt: docChuoi(g(r, "dvt")), dien_giai: dg,
      sl_nhap: docSo(g(r, "sl_nhap")) ?? 0, sl_xuat: docSo(g(r, "sl_xuat")) ?? 0, tk_doi_ung: docChuoi(g(r, "tk_doi_ung")),
    });
  }
  return { rows: out, bo_qua: boQua };
}

// ---------------------------------------------------------------- Xuat theo thang (file tinh)
export interface XtRowTho { thang: string; ma_kho: string | null; ten_kho: string | null; ma_hang: string; ten_hang: string | null; sl_xuat: number }

function docThang(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = typeof v === "number" ? String(Math.round(v)) : String(v).trim();
  if (/^\d{6}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[2]}${m[1].padStart(2, "0")}`;
  const d = docNgay(v);
  return d ? d.slice(0, 4) + d.slice(5, 7) : null;
}

export function docXuatThang(rows: unknown[][]): { rows: XtRowTho[]; bo_qua: number } {
  const t = timCot(
    rows,
    {
      thang: ["thang"], ma_kho: ["ma kho"], ten_kho: ["ten kho"], ma_hang: ["ma hang", "ma san pham"], ten_hang: ["ten hang", "ten san pham"],
      sl_xuat: ["xuat kho", "so luong xuat", "sl xuat", "xuat"],
    },
    ["thang", "ma_hang", "sl_xuat"],
  );
  if (!t) throw new Error("Không tìm thấy dòng tiêu đề (cần cột Tháng, Mã hàng, Xuất kho, và Tên kho hoặc Mã kho).");
  const c = t.cot;
  if (c.ma_kho == null && c.ten_kho == null) throw new Error("Thiếu cột Tên kho / Mã kho.");
  const g = (r: unknown[], k: keyof typeof c) => (c[k] == null ? null : r[c[k]!]);
  let boQua = 0;
  const out: XtRowTho[] = [];
  for (const r of rows.slice(t.dongDau)) {
    const th = docThang(g(r, "thang")), mh = ma(g(r, "ma_hang")), sl = docSo(g(r, "sl_xuat")) ?? 0;
    const mk = ma(g(r, "ma_kho")), tk = docChuoi(g(r, "ten_kho"));
    if (!th || !mh || (!mk && !tk)) {
      boQua++;
      continue;
    }
    if (!sl) continue; // dong khong xuat khong can luu
    out.push({ thang: th, ma_kho: mk, ten_kho: tk, ma_hang: mh, ten_hang: docChuoi(g(r, "ten_hang")), sl_xuat: sl });
  }
  return { rows: out, bo_qua: boQua };
}

// ---------------------------------------------------------------- Khai bao LK / gia nhap (Sheet '3. Khai bao linh kien')
export interface KbRow {
  ma: string; ten?: string | null; phan_loai?: string | null; nganh?: string | null; noi_san_xuat?: string | null; he_so_du_tru?: number | null;
  leadtime?: number | null; doi_tac?: string | null; nhom_tuong_duong?: string | null; gia_nhap?: number | null;
}

export function docKhaiBao(rows: unknown[][]): KbRow[] {
  const t = timCot(
    rows,
    {
      ma: ["ma san pham", "ma hang", "ma linh kien", "ma lk", "ma"], ten: ["ten san pham", "ten hang", "ten linh kien", "ten"],
      noi_san_xuat: ["loai lk", "noi san xuat", "noi sx"], gia_nhap: ["gia nhap"],
      phan_loai: ["nhom linh kien dac biet", "phan loai", "phan loai linh kien", "phan loai dac thu", "phan loai lk"], nganh: ["nganh"],
      he_so_du_tru: ["he so (nk = 4)", "he so", "he so du tru"], nhom_tuong_duong: ["nhom linh kien tuong duong", "nhom tuong duong"],
      leadtime: ["leadtime (khoang ngay du kien co hang sau khi dat)", "leadtime"], doi_tac: ["doi tac"],
    },
    ["ma"],
  );
  if (!t) throw new Error("Không tìm thấy cột Mã sản phẩm / Mã hàng.");
  const c = t.cot;
  const g = (r: unknown[], k: keyof typeof c) => (c[k] == null ? undefined : r[c[k]!]);
  const out: KbRow[] = [];
  for (const r of rows.slice(t.dongDau)) {
    const m = ma(g(r, "ma"));
    if (!m) continue;
    const kb: KbRow = { ma: m };
    for (const k of ["ten", "phan_loai", "nganh", "noi_san_xuat", "doi_tac", "nhom_tuong_duong"] as const) if (c[k] != null) kb[k] = docChuoi(g(r, k));
    for (const k of ["he_so_du_tru", "leadtime", "gia_nhap"] as const) if (c[k] != null) kb[k] = docSo(g(r, k));
    out.push(kb);
  }
  return out;
}

// ---------------------------------------------------------------- Thong tin kho KTV (Sheet '4.3. Cai dat kho')
export interface KhoRow { ma?: string | null; ten?: string | null; lam_viec?: string | null; phong_ban?: string | null; khu_vuc?: string | null }

export function docKho(rows: unknown[][]): KhoRow[] {
  const dn = { ma: ["ma kho", "ma misa"], ten: ["ten tren misa", "ten kho", "ten"], lam_viec: ["lam viec", "trang thai lam viec"], phong_ban: ["phong ban", "bo phan"], khu_vuc: ["khu vuc"] };
  const t = timCot(rows, dn, ["ten"]) ?? timCot(rows, dn, ["ma"]);
  if (!t) throw new Error("Không tìm thấy cột Tên trên MISA / Mã kho.");
  const c = t.cot;
  const g = (r: unknown[], k: keyof typeof c) => (c[k] == null ? null : r[c[k]!]);
  return rows
    .slice(t.dongDau)
    .map((r) => ({ ma: ma(g(r, "ma")), ten: docChuoi(g(r, "ten")), lam_viec: docChuoi(g(r, "lam_viec")), phong_ban: docChuoi(g(r, "phong_ban")), khu_vuc: docChuoi(g(r, "khu_vuc")) }))
    .filter((r) => r.ma || r.ten);
}

// ---------------------------------------------------------------- Ton kho (MISA "Tong hop ton kho" - thay API linh-kien-app)
export interface TonRow { ma_kho: string; ten_kho: string | null; ma_hang: string; ten_hang: string | null; dau_ky: number; nhap_kho: number; xuat_kho: number; cuoi_ky: number }

export function docTonKho(rows: unknown[][]): { rows: TonRow[]; bo_qua: number } {
  const t = timCot(
    rows,
    {
      ma_kho: ["ma kho"], ten_kho: ["ten kho"], ma_hang: ["ma hang", "ma vat tu", "ma san pham"], ten_hang: ["ten hang", "ten vat tu", "ten san pham"],
      dau_ky: ["dau ky so luong", "so luong dau ky", "ton dau ky", "dau ky", "sl dau ky"],
      nhap_kho: ["nhap kho so luong", "so luong nhap kho", "nhap kho", "nhap trong ky", "so luong nhap", "sl nhap"],
      xuat_kho: ["xuat kho so luong", "so luong xuat kho", "xuat kho", "xuat trong ky", "so luong xuat", "sl xuat"],
      cuoi_ky: ["cuoi ky so luong", "so luong cuoi ky", "ton cuoi ky", "cuoi ky", "sl cuoi ky", "ton kho"],
    },
    ["ma_kho", "ma_hang", "cuoi_ky"],
  );
  if (!t) throw new Error("Không tìm thấy dòng tiêu đề (cần cột Mã kho, Mã hàng, Cuối kỳ).");
  const c = t.cot;
  const g = (r: unknown[], k: keyof typeof c) => (c[k] == null ? null : r[c[k]!]);
  let boQua = 0;
  const out: TonRow[] = [];
  for (const r of rows.slice(t.dongDau)) {
    const mk = ma(g(r, "ma_kho")), mh = ma(g(r, "ma_hang"));
    if (!mk || !mh || boDau(mk).startsWith("tong")) {
      boQua++;
      continue;
    }
    out.push({
      ma_kho: mk, ten_kho: docChuoi(g(r, "ten_kho")), ma_hang: mh, ten_hang: docChuoi(g(r, "ten_hang")),
      dau_ky: docSo(g(r, "dau_ky")) ?? 0, nhap_kho: docSo(g(r, "nhap_kho")) ?? 0, xuat_kho: docSo(g(r, "xuat_kho")) ?? 0, cuoi_ky: docSo(g(r, "cuoi_ky")) ?? 0,
    });
  }
  return { rows: out, bo_qua: boQua };
}

// ---------------------------------------------------------------- File mau (tieu de dung voi bo nhan dien cot)
export const FILE_MAU: Record<string, { ten: string; tieu_de: string[]; vi_du: (string | number)[][] }> = {
  sct: {
    ten: "mau-so-chi-tiet-vat-tu.xlsx",
    tieu_de: ["Mã kho", "Tên kho", "Mã hàng", "Tên hàng", "Ngày hạch toán", "Ngày chứng từ", "Số chứng từ", "ĐVT", "Diễn giải", "Số lượng nhập", "Số lượng xuất", "TK đối ứng"],
    vi_du: [["6803", "Kho 6803 - HN", "1000100001", "Lõi lọc số 1", "01/10/2026", "01/10/2026", "XK0001", "Cái", "Xuất cho KTV", 0, 12, "632"]],
  },
  xt: {
    ten: "mau-xuat-kho-theo-thang.xlsx",
    tieu_de: ["Tháng", "Mã kho", "Tên kho", "Mã hàng", "Tên hàng", "Xuất kho"],
    vi_du: [["202609", "6803", "Kho 6803 - HN", "1000100001", "Lõi lọc số 1", 154], ["09/2026", "", "Kho 6804 - HCM", "1000100001", "Lõi lọc số 1", 96]],
  },
  ton: {
    ten: "mau-ton-kho.xlsx",
    tieu_de: ["Mã kho", "Tên kho", "Mã hàng", "Tên hàng", "Đầu kỳ", "Nhập kho", "Xuất kho", "Cuối kỳ"],
    vi_du: [["6803", "Kho 6803 - HN", "1000100001", "Lõi lọc số 1", 300, 120, 154, 266]],
  },
  kb: {
    ten: "mau-khai-bao-linh-kien.xlsx",
    tieu_de: ["Mã sản phẩm", "Tên sản phẩm", "Phân loại", "Ngành", "Nơi sản xuất", "Hệ số dự trữ", "Leadtime", "Đối tác", "Nhóm tương đương", "Giá nhập"],
    vi_du: [["1000100001", "Lõi lọc số 1", "Linh kiện thường dùng", "Lọc nước", "SX", 2, 7, "", "", 45000]],
  },
  kho: {
    ten: "mau-thong-tin-kho-ktv.xlsx",
    tieu_de: ["Mã kho", "Tên trên MISA", "Làm việc", "Phòng ban", "Khu vực"],
    vi_du: [["KTV001", "Nguyễn Văn A", "Làm", "DVBH", "MB1"], ["KTV002", "Trần Văn B", "Nghỉ", "DVBH", "MN2"]],
  },
};

// ---------------------------------------------------------------- Gui theo lo (bang tam + lo cuoi thay du lieu that)
export async function guiTheoLo<T>(duongDan: string, rows: T[], tenFile: string, tienDo?: (da: number, tong: number) => void, themCuoi?: Record<string, unknown>) {
  const lo = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const LO = 500;
  let ketQua: unknown = null;
  for (let i = 0; i < Math.max(rows.length, 1); i += LO) {
    const cuoi = i + LO >= rows.length;
    ketQua = await api(duongDan, { method: "POST", json: { lo, rows: rows.slice(i, i + LO), dau: i === 0, cuoi: cuoi ? { ten_file: tenFile, ...themCuoi } : undefined } });
    tienDo?.(Math.min(i + LO, rows.length), rows.length);
  }
  return ketQua;
}
