// Ham dung chung cho bo tinh toan (thuan, khong dung D1 - test duoc bang node:test).

// ROUNDUP(x, 0) cua Google Sheets: lam tron RA XA so 0. Tru 1e-9 de 12/3 = 4.000000000000001 khong thanh 5.
export function roundUp(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return (x >= 0 ? Math.ceil(x - 1e-9) : -Math.ceil(-x - 1e-9)) || 0;
}

// "YYYYMM" lui k thang. VD thangLui("202610", 1) = "202609", thangLui("202601", 1) = "202512".
export function thangLui(thang: string, k: number): string {
  const y = Number(thang.slice(0, 4));
  const m = Number(thang.slice(4, 6));
  const tong = y * 12 + (m - 1) - k;
  const yy = Math.floor(tong / 12);
  const mm = (tong % 12) + 1;
  return `${yy}${String(mm).padStart(2, "0")}`;
}

// Danh sach thang N, N-1, ..., N-(soThang-1).
export function dayThang(thangN: string, soThang: number): string[] {
  return Array.from({ length: soThang }, (_, k) => thangLui(thangN, k));
}

// Thang "YYYYMM" cua 1 ngay "YYYY-MM-DD".
export function thangCuaNgay(ngay: string): string {
  return ngay.slice(0, 4) + ngay.slice(5, 7);
}

// Ngay "YYYY-MM-DD" lui d ngay (UTC thuan, khong mui gio - ngay hach toan la ngay lich).
export function ngayLui(ngay: string, d: number): string {
  const t = Date.UTC(Number(ngay.slice(0, 4)), Number(ngay.slice(5, 7)) - 1, Number(ngay.slice(8, 10))) - d * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function soNgayGiua(tuNgay: string, denNgay: string): number {
  const a = Date.UTC(Number(tuNgay.slice(0, 4)), Number(tuNgay.slice(5, 7)) - 1, Number(tuNgay.slice(8, 10)));
  const b = Date.UTC(Number(denNgay.slice(0, 4)), Number(denNgay.slice(5, 7)) - 1, Number(denNgay.slice(8, 10)));
  return Math.round((b - a) / 86400000);
}
