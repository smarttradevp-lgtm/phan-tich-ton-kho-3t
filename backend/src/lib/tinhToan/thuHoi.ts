// Bao cao "LK thu hoi DVBH" (thay Sheet '0.5. LK thu hồi DVBH' / '4.1. TỒN KHO LK DVBH' / '4.4. PIVOT').
// Cong thuc: docs/DAC_TA_LOGIC.md muc 5.
import { roundUp } from "./chung.ts";

export type NhomThuHoi = "Nhóm 1" | "Nhóm 2" | "Nhóm 3" | "Nhóm 4";
export const NHOM_THU_HOI: NhomThuHoi[] = ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"];

export interface ThuHoiDauVao {
  kho: string; // ten / ma kho KTV
  ma: string;
  ten: string;
  xuat: number | null; // SL xuat trong ky cua file ton KTV (null/trong = 0)
  ton: number;
  lam_viec: boolean; // KTV con lam viec (kho chua khai bao -> true, chot 29/10/2026)
  phan_loai: string;
  he_so: number; // he so ton theo phan loai
}

export interface ThuHoiDong extends ThuHoiDauVao {
  ton_chuan: number;
  nhom: NhomThuHoi;
  danh_gia: string;
}

// Nhom 1: KTV khong con lam · Nhom 2: con ton, khong xuat (ke ca trong) · Nhom 3: ton > ton chuan · Nhom 4: con lai.
// Sheet so "" voi 0 nen Nhom 2 khong bao gio khop - o day xuat trong = 0.
export function phanNhomThuHoi(r: { lam_viec: boolean; ton: number; xuat: number | null; ton_chuan: number }): NhomThuHoi {
  if (!r.lam_viec) return "Nhóm 1";
  const xuat = r.xuat ?? 0;
  if (r.ton > 0 && xuat === 0) return "Nhóm 2";
  if (r.ton > 0 && r.ton > r.ton_chuan) return "Nhóm 3";
  return "Nhóm 4";
}

// soKy2Tuan: so ky 2 tuan cua khoang xuat (Sheet co dinh 12 = 6 thang). maTran: phan_loai -> nhom -> danh gia.
export function tinhThuHoi(dauVao: ThuHoiDauVao[], soKy2Tuan: number, maTran: Map<string, Map<string, string>>): ThuHoiDong[] {
  const chia = soKy2Tuan > 0 ? soKy2Tuan : 1;
  return dauVao.map((r) => {
    const tonChuan = roundUp(((r.xuat ?? 0) / chia) * r.he_so);
    const nhom = phanNhomThuHoi({ ...r, ton_chuan: tonChuan });
    return { ...r, ton_chuan: tonChuan, nhom, danh_gia: maTran.get(r.phan_loai)?.get(nhom) ?? "" };
  });
}

export interface ThuHoiTongHop {
  phan_loai: string;
  he_so: number;
  tong: number;
  theo_nhom: Record<NhomThuHoi, number>;
}

// Ma tran tong SL ton: Phan loai x Nhom 1-4 (dong TONG o dau tinh o FE).
export function tongHopThuHoi(rows: ThuHoiDong[]): ThuHoiTongHop[] {
  const m = new Map<string, ThuHoiTongHop>();
  for (const r of rows) {
    const g = m.get(r.phan_loai) ?? { phan_loai: r.phan_loai, he_so: r.he_so, tong: 0, theo_nhom: { "Nhóm 1": 0, "Nhóm 2": 0, "Nhóm 3": 0, "Nhóm 4": 0 } };
    g.tong += r.ton;
    g.theo_nhom[r.nhom] += r.ton;
    m.set(r.phan_loai, g);
  }
  return [...m.values()];
}
