# Tổng hợp logic — App Phân tích tồn kho 3T (`phantichtonkho`)

> Mô tả logic **đang chạy thật** (theo code + `docs/DAC_TA_LOGIC.md` tới 17/11/2026). **Công thức chi tiết từng báo cáo nằm ở
> `docs/DAC_TA_LOGIC.md`** — file này là bản tóm tắt để nắm nhanh. Logic đổi thì sửa đè đúng mục (cả 2 file); lịch sử ở
> `nhat_ky_lam_viec.md`. Không ghi tài khoản, mật khẩu, khoá.

## 1. Hệ thống là gì

- Thay Google Sheet "BC tồn kho 3T" bằng app Cloudflare Workers + D1: 1 Worker (Hono) phục vụ `/api/*` + giao diện React.
- 4 báo cáo: **Đắp chiếu**, **Cảnh báo T5**, **Cảnh báo leadtime**, **LK thu hồi DVBH** (+ trang Tổng quan, Hồ sơ linh kiện).
- Báo cáo **tính lúc đọc**, không lưu kết quả. Bộ tính toán thuần ở `backend/src/lib/tinhToan/` (có test đối chiếu số liệu thật của Sheet).
- Kiêm **Kho dữ liệu MISA gốc**: Kế toán nhập file MISA 1 lần ở đây, các app khác (linh-kien-app, DVBH, EO) kéo bản sao qua API đối tác.

## 2. Nguồn dữ liệu

| Dữ liệu | Nguồn | Cập nhật |
|---|---|---|
| Tồn kho công ty + tồn / xuất của KTV | Import file MISA "Tổng hợp tồn kho" tại app này (mỗi file = 1 phiên tồn); trước đây kéo từ linh-kien-app | Khi Kế toán nhập; công tắc `hub_la_nguon_ton` = app này là nguồn |
| Danh mục LK, danh bạ kho / KTV | linh-kien-app API đối tác (`/v1/linh-kien/danh-sach`, `/v1/danh-ba-kho`) | Hằng đêm |
| Sổ chi tiết vật tư (chứng từ × mã × kho × ngày) | Import hằng ngày (file MISA 30 ngày gần nhất) | Tay |
| Xuất theo tháng | Tháng cũ: import tĩnh; tháng mới: cộng từ sổ chi tiết, **chốt tĩnh sau 3 tháng** | Tự động |
| Giá nhập | Import / sửa tay; chưa có → giá dự phòng (gắn nhãn \*) | Khi có |
| Phân loại LK, hệ số, leadtime… | Khai báo trong Cài đặt app này | Tay |
| Dữ liệu ngoài khi mở Hồ sơ LK | linh-kien-app (chi tiết, lịch sử đơn, thiếu hàng, tồn khả dụng), DVBH (ca báo thiếu) | Lúc mở, không lưu |

Quy tắc lưu: import sổ chi tiết **xoá đúng khoảng ngày của file theo kho rồi ghi lại** (import lại không cộng trùng); xuất tháng
thay toàn bộ các tháng có trong file; ô trống khi import khai báo LK = giữ giá trị cũ. Tồn = phiên tồn mới nhất trạng thái `xong`.

## 3. Phân loại kho

`kho.loai`: `cong_ty` / `khac` = kho riêng · `ktv` = gộp "Kho KTV chung" + vào báo cáo thu hồi · `bo_qua` = loại hẳn.
Xuất của kho `ktv` KHÔNG tính vào đắp chiếu. Cột nhập tay (`*_tay`) của kho thắng cột đồng bộ.

## 4. Các báo cáo (tóm tắt — công thức đủ ở `docs/DAC_TA_LOGIC.md`)

| Báo cáo | Ý chính |
|---|---|
| Đắp chiếu | Tháng N = tháng hiện tại (lũy kế). Phân loại đắp chiếu theo tháng xuất gần nhất; TB 3/6 tháng; SL dự trữ tiêu chuẩn = ROUNDUP((TB3 + Xuất tháng N) / 2 × hệ số, mặc định 2); tồn dư = tồn − dự trữ; xếp loại T1–T5. 4 chế độ gộp kho. |
| Cảnh báo T5 | Đắp chiếu lọc xếp loại T5 (trừ "Thuộc diện cắt mã"), sắp tồn dư tăng dần. |
| Cảnh báo leadtime | Tiêu hao 7/14/30 ngày từ sổ chi tiết; số ngày dư = Tồn / (TH/d) − d − leadtime (mặc định 3); 6 mức cảnh báo; tồn chuẩn, SL thiếu cần đặt, tần suất. |
| LK thu hồi DVBH | Theo (kho KTV, mã): tồn chuẩn = ROUNDUP(Xuất / số kỳ 2 tuần × hệ số theo phân loại); phân Nhóm 1–4; đánh giá theo ma trận Phân loại × Nhóm. |
| Tổng quan | Tính lại cả 3 báo cáo + kiểm tra chất lượng dữ liệu. |
| Hồ sơ linh kiện | Popup theo 1 mã: tiêu hao, rủi ro, nguồn hàng, mã tương đương, cung ứng, chứng từ; tính lại riêng cho mã đó (khớp báo cáo đầy đủ). |

Tham số (hệ số mặc định, ngưỡng, cửa sổ ngày, số tháng chốt…) là 1 JSON trong `app_settings.tham_so`; thiếu khoá → mặc định.

## 5. Kho dữ liệu MISA cho app khác

- API `/api/doi-tac/v1/misa/*` (tồn kho, sổ chi tiết, xuất tháng), khoá API băm lưu trong `doi_tac_api_key`, quyền theo tập dữ liệu,
  giới hạn tần suất theo khoá. Chỉ phát phiên tồn nhập tại app này.
- Nhập xong file tồn → báo linh-kien-app có phiên mới. Phía linh-kien-app có công tắc nguồn tồn kho (file / hub thử / hub).
- Tài liệu: `docs/API_DOI_TAC_MISA.md`, lộ trình `docs/KE_HOACH_KHO_MISA.md`.

## 6. Quản trị & nhật ký

Chỉ Admin: đếm dòng từng bảng, quản lý phiên tồn (không xoá phiên đang dùng), dọn sổ chi tiết cũ (chỉ tháng đã chốt tĩnh), xoá xuất
tháng tĩnh, khoá API đối tác. Mọi thao tác cài đặt / người dùng / dọn dữ liệu ghi `nhat_ky`.

## 7. Lịch chạy tự động

| Lịch | Việc |
|---|---|
| Mỗi giờ (`0 * * * *`) | Đồng bộ tồn kho (khi chưa dùng app này làm nguồn) |
| 01:00 VN | Danh mục LK + danh bạ kho, chốt tĩnh xuất tháng đã qua 3 tháng |

## 8. Tài liệu liên quan

`docs/DAC_TA_LOGIC.md` (công thức chốt), `docs/API_DOI_TAC_MISA.md`, `docs/KE_HOACH_KHO_MISA.md`, `docs/HUONG_DAN_TRIEN_KHAI.md`,
`CLAUDE.md`, `SRS_tong_hop.md`, `nhat_ky_lam_viec.md`.
