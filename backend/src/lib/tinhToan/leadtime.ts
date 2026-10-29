// Bao cao "Canh bao leadtime" (thay Sheet '0.2. Cảnh báo leadtime' / '0.2.2.' / '2.2.3. leadtime').
// Cong thuc: docs/DAC_TA_LOGIC.md muc 4.
import type { ThamSo } from "./thamSo.ts";

export type MucCanhBao =
  | "1. Thiếu hàng nghiêm trọng"
  | "2. Thiếu hàng"
  | "3. Tới thời điểm đặt hàng"
  | "4. Bình thường"
  | "5. Hết tồn - không tiêu hao"
  | "6. Còn tồn - không tiêu hao";

export const MUC_CANH_BAO: MucCanhBao[] = [
  "1. Thiếu hàng nghiêm trọng",
  "2. Thiếu hàng",
  "3. Tới thời điểm đặt hàng",
  "4. Bình thường",
  "5. Hết tồn - không tiêu hao",
  "6. Còn tồn - không tiêu hao",
];

export type TanSuat = "Ít tiêu hao" | "Tiêu nhiều" | "Tiêu đều" | "Khác (còn lại)";

export interface LeadtimeDauVao {
  kho: string;
  ma: string;
  ten: string;
  tieu_hao: [number, number, number]; // theo 3 cua so (7/14/30 ngay)
  ton: number;
  leadtime?: number | null;
  he_so_nk?: number | null;
  hang_dang_ve?: number; // SL EO dang ve (khi co nguon); tru vao SL can dat
}

export interface LeadtimeDong {
  kho: string;
  ma: string;
  ten: string;
  tieu_hao: [number, number, number];
  ton: number;
  so_ngay_du: (number | null)[]; // null = het ton / khong tieu hao
  canh_bao: [MucCanhBao, MucCanhBao, MucCanhBao];
  tb_ngay: number;
  ton_chuan: number;
  sl_thieu_can_dat: number;
  tan_suat: TanSuat;
  he_so_nk: number;
  leadtime: number;
  hang_dang_ve: number;
}

// So ngay du = Ton / (TH_d / d) - d - Leadtime. Chot 29/10/2026: GIU tru d de bao som thoi diem dat hang.
export function mucCanhBao(ton: number, th: number, d: number, leadtime: number, ts: ThamSo): { muc: MucCanhBao; soNgay: number | null } {
  if (ton + th === 0) return { muc: "5. Hết tồn - không tiêu hao", soNgay: null };
  if (th === 0) return { muc: "6. Còn tồn - không tiêu hao", soNgay: null };
  const soNgay = ton / (th / d) - d - leadtime;
  let muc: MucCanhBao;
  if (soNgay < ts.nguong_thieu_nghiem_trong) muc = "1. Thiếu hàng nghiêm trọng";
  else if (soNgay < ts.nguong_thieu) muc = "2. Thiếu hàng";
  else if (soNgay <= ts.nguong_toi_diem_dat) muc = "3. Tới thời điểm đặt hàng";
  else muc = "4. Bình thường";
  return { muc, soNgay };
}

export function tanSuat(th: [number, number, number], ts: ThamSo): TanSuat {
  const [t7, t14, t30] = th;
  if (t30 <= ts.tan_suat_it) return "Ít tiêu hao";
  const [n30, n14, n7] = ts.tan_suat_nhieu;
  if (t30 >= n30 && t14 >= n14 && t7 >= n7) return "Tiêu nhiều";
  const [d30, d14, d7] = ts.tan_suat_deu;
  if (t30 >= d30 && t14 >= d14 && t7 >= d7) return "Tiêu đều";
  return "Khác (còn lại)";
}

export function tinhLeadtime(dauVao: LeadtimeDauVao[], ts: ThamSo): LeadtimeDong[] {
  const [d1, d2, d3] = ts.cua_so_ngay;
  return dauVao.map((r) => {
    const leadtime = r.leadtime ?? ts.leadtime_mac_dinh;
    const heSo = r.he_so_nk ?? ts.he_so_nk_mac_dinh;
    const kq = [d1, d2, d3].map((d, i) => mucCanhBao(r.ton, r.tieu_hao[i], d, leadtime, ts));
    const tbNgay = (r.tieu_hao[0] / d1 + r.tieu_hao[1] / d2 + r.tieu_hao[2] / d3) / 3;
    const tonChuan = tbNgay * heSo * 30;
    const dangVe = r.hang_dang_ve ?? 0;
    return {
      kho: r.kho,
      ma: r.ma,
      ten: r.ten,
      tieu_hao: r.tieu_hao,
      ton: r.ton,
      so_ngay_du: kq.map((k) => k.soNgay),
      canh_bao: [kq[0].muc, kq[1].muc, kq[2].muc],
      tb_ngay: tbNgay,
      ton_chuan: tonChuan,
      sl_thieu_can_dat: tonChuan - r.ton - dangVe,
      tan_suat: tanSuat(r.tieu_hao, ts),
      he_so_nk: heSo,
      leadtime,
      hang_dang_ve: dangVe,
    };
  });
}
