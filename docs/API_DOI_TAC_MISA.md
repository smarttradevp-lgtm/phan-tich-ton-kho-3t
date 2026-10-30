# API đối tác — Kho dữ liệu MISA (app Phân tích tồn kho 3T)

Dành cho các hệ thống kéo dữ liệu MISA gốc về: linh-kien-app, DVBH, EO Mua hàng… Kế hoạch tổng thể: `docs/KE_HOACH_KHO_MISA.md`.

## 1. Chung

| Mục | Giá trị |
|---|---|
| Địa chỉ gốc | `https://phantichtonkho.dichvu3t.workers.dev/api/doi-tac` — Worker cùng tài khoản Cloudflare gọi qua **Service Binding** (Worker `phantichtonkho`), không qua `*.workers.dev` |
| Phương thức | Chỉ `GET`, JSON UTF-8 |
| Xác thực | Header `X-API-Key: <khoá>`. Admin tạo khoá ở **Quản trị › Kho dữ liệu MISA**, mỗi bên 1 khoá, chọn tập dữ liệu được đọc (`ton_kho`, `so_chi_tiet`, `xuat_thang`). Khoá chỉ hiện 1 lần |
| Giới hạn | 120 yêu cầu / phút / khoá → 429 `TOO_MANY_REQUESTS` |
| Thời gian | Giờ Việt Nam `YYYY-MM-DD HH:MM:SS`, ngày `YYYY-MM-DD`, tháng `YYYYMM` |
| Lỗi | 401 `MISSING_API_KEY` / `INVALID_API_KEY` · 403 `FORBIDDEN_DATASET` (khoá không có quyền tập đó) · 400 tham số sai |

Nguyên tắc: **kéo về giữ bản sao**, chỉ kéo lại khi phiên bản đổi. Không gọi API này trong lúc xử lý nghiệp vụ của mình.

## 2. Tồn kho (file "Tổng hợp tồn kho")

### `GET /v1/misa/ton-kho/meta`
```json
{ "phien_ban": "2026-10-30 08:15:02", "ky_tu_ngay": "2026-10-01", "ky_den_ngay": "2026-10-30", "so_dong": 10072, "ten_file": "ton_kho_3010.xlsx" }
```
`phien_ban` = lúc Kế toán nhập xong file ở app này. Đổi ⇔ có file mới. Chưa có phiên → `{ "phien_ban": null }`.
**Bên kéo nên dùng `phien_ban` làm "mốc nhập tồn" của mình** (không dùng giờ kéo về).

### `GET /v1/misa/ton-kho?phien_ban=&after=&limit=`
| Tham số | |
|---|---|
| `phien_ban` | Nên gửi (lấy từ meta). Nếu đã có phiên mới hơn → **409** `PHIEN_BAN_DA_DOI` kèm `phien_ban` mới → bỏ phần đã kéo, bắt đầu lại |
| `after` | Con trỏ: `next_after` của trang trước; trang đầu bỏ trống |
| `limit` | Mặc định 1000, tối đa 2000 |

```json
{ "phien_ban": "2026-10-30 08:15:02", "ky_tu_ngay": "2026-10-01", "ky_den_ngay": "2026-10-30",
  "rows": [ { "id": 1, "ma_kho": "6803", "ten_kho": "Kho 6803 - Q2 HCM", "ma_hang": "2013010021", "ten_hang": "Dây RO 1/4 trắng KAROFI",
              "dvt": "Mét", "dau_ky": 0, "nhap_kho": 300, "xuat_kho": 115, "cuoi_ky": 185 } ],
  "next_after": 1000 }
```
Dòng **thô đúng như file** — không phân loại kho KTV / kho công ty (bên kéo tự phân loại theo danh bạ của mình).
`next_after = null` = trang cuối; khi đó app ghi nhận bên này "đã kéo phiên mới" (hiện cho Kế toán ở màn Nhập dữ liệu).

**Báo phiên mới (chỉ linh-kien-app)**: nhập xong, app gọi `POST <linh-kien-app>/api/hub-misa/thong-bao` `{phien_ban}` header
`X-Sync-Key` (secret chung `HUB_SYNC_KEY`) qua Service Binding. Lỗi thì bỏ qua — bên kéo vẫn phải tự kiểm tra meta định kỳ.

## 3. Sổ chi tiết vật tư

### `GET /v1/misa/so-chi-tiet/meta`
```json
{ "lan_import_cuoi": { "id": 12, "luc": "2026-10-30 08:20:11", "tu_ngay": "2026-10-01", "den_ngay": "2026-10-29", "so_dong": 23766, "ten_file": "sct.xlsx" },
  "du_lieu": { "tu": "2026-09-28", "den": "2026-10-29", "n": 23766 } }
```
Mỗi lần nhập **thay toàn bộ** dòng của các kho có trong file trong khoảng `[tu_ngay, den_ngay]` → `id` của khoảng đó đổi. Bên kéo:
khi `lan_import_cuoi.id` đổi → kéo lại đúng khoảng `tu_ngay..den_ngay` và **thay** bản sao của mình trong khoảng đó (hoặc so theo khoá tự
nhiên riêng, vd EO: `SỐ_CT|Tên kho|MÃ_HÀNG|SL nhập|Ngày CT|MÃ_PHÊ_DUYỆT`).

### `GET /v1/misa/so-chi-tiet?tu=&den=&ma_kho=&ma=&chi_nhap=1&after_id=&limit=`
| Tham số | |
|---|---|
| `tu`, `den` | **Bắt buộc**, theo ngày hạch toán |
| `ma_kho`, `ma` | Danh sách cách dấu phẩy (≤ 200) |
| `chi_nhap=1` | Chỉ dòng có SL nhập (phiếu nhập — cho EO) |
| `after_id`, `limit` | Con trỏ theo `id`; `limit` mặc định 1000, tối đa 2000 |

Mỗi dòng: `id, ma_kho, ten_kho, ma_hang, ten_hang, ngay_hach_toan, ngay_chung_tu, so_chung_tu, dvt, dien_giai, sl_nhap, sl_xuat, sl_ton,
tk_kho, tk_doi_ung, ma_phe_duyet, import_id` (cột không có trong file = null). Trả kèm `next_after_id` (null = hết).

## 4. Xuất kho theo tháng

### `GET /v1/misa/xuat-thang?thang=202609,202610&ma=`
Xuất kho theo (tháng, mã kho, mã hàng). Tháng có trong `thang_tinh` = số tĩnh (file tháng cũ / hệ thống đã chốt); tháng khác cộng
động từ sổ chi tiết (tháng hiện tại = lũy kế tới ngày sổ chi tiết mới nhất). Tối đa 24 tháng / lần.
```json
{ "thang_tinh": ["202609"], "rows": [ { "thang": "202609", "ma_kho": "6803", "ma_hang": "2013010021", "ten_hang": "...", "sl": 27.71 } ] }
```
