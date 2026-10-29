// Gio VN "YYYY-MM-DD HH:MM:SS" - moi cot thoi gian trong DB luu gio VN (cung quy uoc linh-kien-app).
export function nowVN(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

export function homNayVN(): string {
  return nowVN().slice(0, 10);
}

// Thang hien tai gio VN "YYYYMM".
export function thangHienTaiVN(): string {
  const d = homNayVN();
  return d.slice(0, 4) + d.slice(5, 7);
}
