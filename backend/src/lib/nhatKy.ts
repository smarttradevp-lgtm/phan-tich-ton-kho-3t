import { nowVN } from "./vnTime";

// Ghi 1 dong nhat ky thao tac (cai dat / quan tri). Tra ve lenh de gop vao batch cua thao tac chinh.
export function lenhNhatKy(db: D1Database, nguoi: string | null, hanhDong: string, chiTiet?: unknown): D1PreparedStatement {
  return db
    .prepare("INSERT INTO nhat_ky (luc, nguoi, hanh_dong, chi_tiet) VALUES (?, ?, ?, ?)")
    .bind(nowVN(), nguoi, hanhDong, chiTiet == null ? null : typeof chiTiet === "string" ? chiTiet : JSON.stringify(chiTiet));
}
