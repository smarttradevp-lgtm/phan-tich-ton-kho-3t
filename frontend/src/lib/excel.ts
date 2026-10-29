// Doc file Excel / CSV tren trinh duyet + nhan dien cot theo tieu de tieng Viet (bo dau, khong phan biet hoa thuong).
import type * as XLSXType from "xlsx";

let xlsxMod: typeof XLSXType | null = null;
export async function xlsx(): Promise<typeof XLSXType> {
  return (xlsxMod ??= await import("xlsx"));
}

export const boDau = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export async function docFile(file: File): Promise<unknown[][]> {
  const X = await xlsx();
  const buf = await file.arrayBuffer();
  const wb = /\.csv$/i.test(file.name)
    ? X.read(new TextDecoder("utf-8").decode(buf), { type: "string", raw: true })
    : X.read(buf, { type: "array", cellDates: false, cellText: false, cellNF: false, cellStyles: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // File MISA hay khai bao vung !ref toi hang trieu dong -> thu gon theo o co du lieu.
  const ref = ws["!ref"];
  if (ref) {
    let maxR = 0, maxC = 0;
    for (const k of Object.keys(ws)) {
      if (k[0] === "!") continue;
      const a = X.utils.decode_cell(k);
      if (a.r > maxR) maxR = a.r;
      if (a.c > maxC) maxC = a.c;
    }
    ws["!ref"] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  }
  return X.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
}

export type DinhNghiaCot = Record<string, string[]>; // khoa -> cac ten tieu de chap nhan (da bo dau)

// Tim dong tieu de (trong 30 dong dau) chua du cac cot bat buoc. Tieu de 2 tang (MISA: "Nhập" / "Số lượng") -> ghep
// "nhap so luong" + "so luong nhap". Tra vi tri cot cho tung khoa.
export function timCot<D extends DinhNghiaCot>(rows: unknown[][], dn: D, batBuoc: NoInfer<keyof D & string>[]): { dongDau: number; cot: Partial<Record<keyof D & string, number>> } | null {
  type K = keyof D & string;
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const r1 = (rows[i] ?? []).map(boDau);
    const r2 = (rows[i + 1] ?? []).map(boDau);
    const ten: string[][] = [];
    let cha = "";
    const n = Math.max(r1.length, r2.length);
    for (let c = 0; c < n; c++) {
      if (r1[c]) cha = r1[c];
      const con = r2[c] ?? "";
      ten.push([r1[c] ?? "", con && cha ? `${cha} ${con}` : "", con && cha ? `${con} ${cha}` : ""].filter(Boolean));
    }
    const cot: Partial<Record<K, number>> = {};
    for (const k of Object.keys(dn) as K[]) {
      const idx = ten.findIndex((ds) => ds.some((t) => dn[k].includes(t)));
      if (idx >= 0) cot[k] = idx;
    }
    if (batBuoc.every((k) => cot[k] != null)) {
      const haiTang = (Object.keys(cot) as K[]).some((k) => !r1[cot[k]!] || !dn[k].includes(r1[cot[k]!]));
      return { dongDau: i + (haiTang ? 2 : 1), cot };
    }
  }
  return null;
}

// So: number giu nguyen; chuoi "1.234,5" (kieu VN) / "1,234.5" / "12" -> number; trong -> null.
export function docSo(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s/g, "");
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^-?\d+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Ngay: serial Excel / "dd/mm/yyyy" / "yyyy-mm-dd" -> "YYYY-MM-DD".
export function docNgay(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export const docChuoi = (v: unknown) => {
  if (v == null) return null;
  const s = typeof v === "number" ? String(v) : String(v).trim();
  return s || null;
};

// Xuat bang ra file .xlsx.
export async function taiExcel(tenFile: string, tieuDe: string[], dong: (string | number | null)[][]) {
  const X = await xlsx();
  const ws = X.utils.aoa_to_sheet([tieuDe, ...dong]);
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, "Du lieu");
  X.writeFile(wb, tenFile);
}
