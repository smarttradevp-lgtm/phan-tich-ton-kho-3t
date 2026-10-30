// Khoa API doi tac (bang doi_tac_api_key): luu ban bam SHA-256, khoa goc chi hien 1 lan luc tao.
export const TAP_DU_LIEU = ["ton_kho", "so_chi_tiet", "xuat_thang"] as const;
export type TapDuLieu = (typeof TAP_DU_LIEU)[number];

export async function bamKhoa(khoa: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(khoa));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 64 ky tu hex ngau nhien (giong khoa doi tac cua linh-kien-app).
export function taoKhoa(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
