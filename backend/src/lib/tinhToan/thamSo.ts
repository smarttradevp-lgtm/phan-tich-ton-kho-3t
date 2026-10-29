// Tham so chung cua 4 bao cao - luu o app_settings key 'tham_so' (JSON), sua o man Cai dat.
// Gia tri mac dinh = dung nhu Google Sheet "BC tồn kho 3T" (phan tich 29/10/2026, docs/DAC_TA_LOGIC.md).

export interface ThamSo {
  // ---- Dap chieu / T5 ----
  he_so_du_tru_mac_dinh: number; // LK chua khai bao he so -> 2 (Sheet '3.1. Pivot' cot I)
  so_thang_hien_thi: number; // so cot "Xuat thang N-k" (Sheet hien 16)
  // ---- Leadtime ----
  cua_so_ngay: [number, number, number]; // 7 / 14 / 30
  leadtime_mac_dinh: number; // LK chua khai bao leadtime -> 3
  he_so_nk_mac_dinh: number; // LK chua khai bao he so -> 3 (KHAC dap chieu = 2, giu nhu Sheet)
  nguong_thieu_nghiem_trong: number; // so ngay du < -3
  nguong_thieu: number; // < 0
  nguong_toi_diem_dat: number; // <= 2
  tan_suat_it: number; // TH30 <= 5
  tan_suat_nhieu: [number, number, number]; // TH30 >= 100, TH14 >= 50, TH7 >= 20
  tan_suat_deu: [number, number, number]; // TH30 >= 30, TH14 >= 14, TH7 >= 7
  // ---- Thu hoi ----
  so_ky_2_tuan_mac_dinh: number; // Sheet chia co dinh /12 (6 thang); dung khi khong biet ky cua file ton KTV
  phan_loai_chua_cai_dat: string; // LK chua co phan loai -> ten nay (he so lay tu bang phan_loai_lk)
  // ---- Chot thang ----
  so_thang_chot_tinh: number; // thang M duoc chot tinh khi da qua bao nhieu thang (3)
}

export const THAM_SO_MAC_DINH: ThamSo = {
  he_so_du_tru_mac_dinh: 2,
  so_thang_hien_thi: 16,
  cua_so_ngay: [7, 14, 30],
  leadtime_mac_dinh: 3,
  he_so_nk_mac_dinh: 3,
  nguong_thieu_nghiem_trong: -3,
  nguong_thieu: 0,
  nguong_toi_diem_dat: 2,
  tan_suat_it: 5,
  tan_suat_nhieu: [100, 50, 20],
  tan_suat_deu: [30, 14, 7],
  so_ky_2_tuan_mac_dinh: 12,
  phan_loai_chua_cai_dat: "Chưa cài đặt",
  so_thang_chot_tinh: 3,
};

// Gop gia tri da luu voi mac dinh (khoa thieu / sai kieu -> mac dinh), de them tham so moi khong vo cau hinh cu.
export function docThamSo(raw: unknown): ThamSo {
  const out: ThamSo = structuredClone(THAM_SO_MAC_DINH);
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(out) as (keyof ThamSo)[]) {
    const v = r[k];
    const def = out[k];
    if (Array.isArray(def)) {
      if (Array.isArray(v) && v.length === def.length && v.every((x) => typeof x === "number" && Number.isFinite(x))) (out as unknown as Record<string, unknown>)[k] = v;
    } else if (typeof def === typeof v && (typeof v !== "number" || Number.isFinite(v))) {
      (out as unknown as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
