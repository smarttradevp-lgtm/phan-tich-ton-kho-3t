import { useCallback, useState } from "react";

// Dieu huong hash "#/trang?tham_so". Tach rieng de cac trang khong phai import App (tranh vong import).
// Bo loc cua moi trang nam trong phan "?..." cua hash -> gui link la nguoi khac thay dung cach xem; dong thoi luu
// localStorage theo trang de mo lai (bam menu "#/trang" khong co "?") van giu bo loc lan truoc.

export const moTrang = (k: string) => (location.hash = `/${k}`);

export const trangHienTai = () => location.hash.replace(/^#\/?/, "").split("?")[0] || "tong-quan";
const KHOA_LUU = (t: string) => `ptk-loc:${t}`;

function docQ(): URLSearchParams {
  const h = location.hash;
  const i = h.indexOf("?");
  return new URLSearchParams(i < 0 ? "" : h.slice(i + 1));
}

function ghiQ(q: URLSearchParams) {
  const t = trangHienTai();
  const s = q.toString();
  history.replaceState(null, "", `#/${t}${s ? `?${s}` : ""}`);
  try {
    if (s) localStorage.setItem(KHOA_LUU(t), s);
    else localStorage.removeItem(KHOA_LUU(t));
  } catch {
    /* localStorage bi chan -> chi giu tren URL */
  }
}

// Goi khi vao trang (hashchange / tai trang): hash chua co "?" thi khoi phuc bo loc da luu cua trang do.
export function khoiPhucLoc() {
  if (location.hash.includes("?")) return;
  try {
    const s = localStorage.getItem(KHOA_LUU(trangHienTai()));
    if (s) history.replaceState(null, "", `#/${trangHienTai()}?${s}`);
  } catch {
    /* bo qua */
  }
}

// Xoa moi bo loc cua trang hien tai (URL + da luu).
export function xoaLocTrang() {
  try {
    localStorage.removeItem(KHOA_LUU(trangHienTai()));
  } catch {
    /* bo qua */
  }
  history.replaceState(null, "", `#/${trangHienTai()}`);
  dispatchEvent(new Event("xoa-loc"));
}

export const coLocTrang = () => location.hash.includes("?");

// State dong bo voi 1 tham so tren URL. khoa = null -> state thuong (khong luu). Chuoi luu tho, kieu khac luu JSON.
export function useUrlState<T>(khoa: string | null, macDinh: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    if (!khoa) return macDinh;
    const s = docQ().get(khoa);
    if (s == null) return macDinh;
    if (typeof macDinh === "string") return s as T;
    try {
      return JSON.parse(s) as T;
    } catch {
      return macDinh;
    }
  });
  const macDinhJson = JSON.stringify(macDinh);
  const dat = useCallback(
    (x: T) => {
      setV(x);
      if (!khoa) return;
      const q = docQ();
      if (JSON.stringify(x) === macDinhJson) q.delete(khoa);
      else q.set(khoa, typeof x === "string" ? x : JSON.stringify(x));
      ghiQ(q);
    },
    [khoa, macDinhJson],
  );
  return [v, dat];
}
