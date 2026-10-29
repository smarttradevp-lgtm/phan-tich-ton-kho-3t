// Bao cao "Dap chieu" + "Canh bao T5" (thay Sheet '0. BC đắp chiếu' / '0.1. Cảnh báo T5' / '3.1. Pivot').
// Cong thuc: docs/DAC_TA_LOGIC.md muc 2-3.
import { roundUp, dayThang } from "./chung.ts";
import type { ThamSo } from "./thamSo.ts";

export type XepLoai = "T1" | "T2" | "T3" | "T4" | "T5";

export interface KhaiBaoLk {
  ten?: string | null;
  phan_loai?: string | null;
  nganh?: string | null;
  noi_san_xuat?: string | null;
  he_so_du_tru?: number | null;
  gia_nhap?: number | null;
  gia_nhap_nguon?: "nhap" | "du_phong" | "khong_co"; // khong_co = chua co gia nhap lan gia du phong (gia = 0)
}

export interface DapChieuDauVao {
  nhom: string; // nhom kho sau khi ap che do gop
  ma: string;
  ten: string;
  ton: number;
  xuat: Map<string, number>; // thang "YYYYMM" -> SL xuat
}

export interface DapChieuDong {
  nhom: string;
  ma: string;
  ten: string;
  xep_loai: XepLoai;
  phan_loai_dap_chieu: string; // B00..B12 / D00..D12
  noi_san_xuat: string;
  phan_loai: string;
  nganh: string;
  he_so: number;
  ton: number;
  tb3: number;
  tb6: number;
  du_tru: number;
  ton_du: number;
  gia_nhap: number;
  gia_nhap_nguon: "nhap" | "du_phong" | "khong_co";
  gia_tri_ton: number;
  gia_tri_du_tru: number;
  gia_tri_ton_du: number;
  xuat: number[]; // [Xuat_0 = thang N, Xuat_1, ...] do dai = so_thang_hien_thi
}

export const CHUA_KHAI_BAO = "Chưa khai báo";

export function xepLoai(tonDu: number, duTru: number): XepLoai {
  if (tonDu < 0) return "T5";
  if (tonDu === 0) return "T1";
  if (tonDu <= duTru / 2) return "T2";
  if (tonDu > duTru) return "T4";
  return "T3";
}

// "B" + so thang lien tiep khong xuat tinh tu thang N (0..11), khong xuat ca 12 thang -> 12. Nganh Dieu hoa -> "D".
export function phanLoaiDapChieu(xuat: number[], nganh: string | null | undefined): string {
  let k = xuat.slice(0, 12).findIndex((x) => x > 0);
  if (k < 0) k = 12;
  return (nganh === "Điều hòa" ? "D" : "B") + String(k).padStart(2, "0");
}

export function tinhDapChieu(thangN: string, dauVao: DapChieuDauVao[], khaiBao: Map<string, KhaiBaoLk>, ts: ThamSo): DapChieuDong[] {
  const soThang = Math.max(12, ts.so_thang_hien_thi);
  const thang = dayThang(thangN, soThang);
  return dauVao.map((d) => {
    const kb = khaiBao.get(d.ma) ?? {};
    const xuat = thang.map((t) => d.xuat.get(t) ?? 0);
    // Chot 29/10/2026: thang khong xuat tinh = 0, chia co dinh 3 / 6 (Sheet dung AVERAGEA bo qua o trong).
    const tb3 = roundUp((xuat[0] + xuat[1] + xuat[2]) / 3);
    const tb6 = roundUp(xuat.slice(0, 6).reduce((s, x) => s + x, 0) / 6);
    const heSo = kb.he_so_du_tru ?? ts.he_so_du_tru_mac_dinh;
    const duTru = roundUp(((tb3 + xuat[0]) / 2) * heSo);
    const tonDu = d.ton - duTru;
    // Chot 29/10/2026: chua co gia nhap -> gia du phong (da gan o duLieuBaoCao), khong co -> 0.
    const gia = kb.gia_nhap ?? 0;
    return {
      nhom: d.nhom,
      ma: d.ma,
      ten: kb.ten || d.ten,
      xep_loai: xepLoai(tonDu, duTru),
      phan_loai_dap_chieu: phanLoaiDapChieu(xuat, kb.nganh),
      noi_san_xuat: kb.noi_san_xuat || CHUA_KHAI_BAO,
      phan_loai: kb.phan_loai || CHUA_KHAI_BAO,
      nganh: kb.nganh || CHUA_KHAI_BAO,
      he_so: heSo,
      ton: d.ton,
      tb3,
      tb6,
      du_tru: duTru,
      ton_du: tonDu,
      gia_nhap: gia,
      gia_nhap_nguon: kb.gia_nhap_nguon ?? (kb.gia_nhap != null ? "nhap" : "khong_co"),
      gia_tri_ton: gia * d.ton,
      gia_tri_du_tru: gia * duTru,
      gia_tri_ton_du: gia * d.ton - gia * duTru,
      xuat: xuat.slice(0, ts.so_thang_hien_thi),
    };
  });
}

// "Canh bao T5" = dap chieu, chi T5 va khong thuoc dien cat ma; thieu nhieu nhat len dau.
export function locT5(rows: DapChieuDong[]): DapChieuDong[] {
  return rows.filter((r) => r.xep_loai === "T5" && r.phan_loai !== "Thuộc diện cắt mã").sort((a, b) => a.ton_du - b.ton_du);
}
