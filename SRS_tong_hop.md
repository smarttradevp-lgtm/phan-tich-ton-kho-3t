# SRS tổng hợp — App Phân tích tồn kho 3T

> Đặc tả yêu cầu **đã chốt** (theo `docs/DAC_TA_LOGIC.md` bản chốt 3 + code tới 17/11/2026). Công thức: `docs/DAC_TA_LOGIC.md`;
> logic tóm tắt: `TONG_HOP_LOGIC.md`.

## 1. Mục tiêu

Thay Google Sheet "BC tồn kho 3T" bằng app web: số liệu tồn kho / tiêu hao / dự trữ tính tự động, đúng công thức đã chốt, cảnh
báo sớm linh kiện sắp thiếu hoặc tồn dư, và là nơi nhập dữ liệu MISA gốc cho các app khác.

## 2. Người dùng

| Vai trò | Nhu cầu |
|---|---|
| Người dùng đã duyệt (Kho, Mua hàng, Kế toán, quản lý) | Xem 4 báo cáo, Tổng quan, Hồ sơ linh kiện; nhập dữ liệu; khai báo LK / kho |
| Admin | Như trên + duyệt người dùng, quản trị dữ liệu, khoá API đối tác, công tắc nguồn tồn kho |

Đăng nhập Google; tài khoản mới chờ Admin duyệt.

## 3. Màn hình & chức năng

| # | Màn hình | Yêu cầu |
|---|---|---|
| F1 | Tổng quan | Chỉ số chính 3 báo cáo + cảnh báo chất lượng dữ liệu |
| F2 | Đắp chiếu | Bảng theo (nhóm kho, mã); 4 chế độ gộp kho; lọc phân loại đắp chiếu / phân loại LK / xếp loại; ghi rõ "Tháng N lũy kế tới ngày dd/mm"; dòng dùng giá dự phòng gắn nhãn |
| F3 | Cảnh báo T5 | Đắp chiếu chỉ T5, sắp tồn dư tăng dần |
| F4 | Cảnh báo leadtime | Mức cảnh báo 7/14/30 ngày, tồn chuẩn, SL thiếu cần đặt, tần suất, số ca DVBH báo thiếu |
| F5 | LK thu hồi DVBH | Theo kho KTV × mã: tồn chuẩn, nhóm 1–4, đánh giá; tổng theo Phân loại × Nhóm; lọc phòng ban / khu vực; kho chưa khai báo liệt kê riêng |
| F6 | Hồ sơ linh kiện | Popup ~95% màn hình mở từ mọi bảng, ‹ › chuyển mã trong danh sách đang xem; 6 vùng thông tin; dữ liệu hệ thống khác lỗi thì chỉ thẻ đó báo lỗi |
| F7 | Import | Sổ chi tiết hằng ngày, xuất tháng tĩnh, giá nhập, tồn kho MISA (chọn kỳ từ – đến), khai báo LK; xem lịch sử import + mốc dữ liệu |
| F8 | Cài đặt | Khai báo theo LK (phân loại, ngành, nơi SX, hệ số dự trữ, leadtime, đối tác, giá nhập), kho KTV ngoài danh bạ, tham số chung, gộp phân loại viết khác hoa/thường |
| F9 | Quản trị (Admin) | Dữ liệu hệ thống, phiên tồn, dọn dữ liệu, nhật ký, khoá API, đối chiếu 2 phiên tồn |

### Yêu cầu chung cho bảng

Kiểu bảng Excel: tìm không dấu, bấm tiêu đề để sắp xếp, lọc cột (chọn nhiều giá trị / khoảng số), tổng và file Excel lấy danh sách
SAU lọc; bộ lọc nằm trên URL (gửi link là mở đúng bộ lọc); mobile hiện dạng thẻ.

## 4. Yêu cầu phi chức năng

- Báo cáo tính lúc đọc từ dữ liệu mới nhất, không lưu kết quả.
- Import lại không cộng trùng dữ liệu; dừng giữa chừng không mất dữ liệu cũ (ghi bảng tạm, lô cuối mới thay).
- Kết quả phải khớp Sheet cũ ở các chỉ số không dính lỗi Sheet (đã đối chiếu: phân loại đắp chiếu 3.546/3.546 dòng, leadtime 2.075 dòng).
- Mọi thời gian theo giờ Việt Nam.
