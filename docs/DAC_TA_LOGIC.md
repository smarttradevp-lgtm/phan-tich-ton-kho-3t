# Phân tích tồn kho 3T — Đặc tả logic + nguồn dữ liệu (bản chốt 3, 29/10/2026)

Nguồn logic: Google Sheet "BC tồn kho 3T" (`0. BC đắp chiếu`, `0.1. Cảnh báo T5`, `0.2. Cảnh báo leadtime`,
`0.5. LK thu hồi DVBH`), phân tích công thức ngày 29/10/2026.
**[CHỐT]** = quyết định người dùng · **[CẦN XÁC NHẬN]** = còn mở.

---

## 1. Nguồn dữ liệu & lịch cập nhật

| Mã | Dữ liệu | Nguồn **[CHỐT]** | Cập nhật |
|---|---|---|---|
| S1 | Tồn kho công ty (kho × mã) | linh-kien-app API `/api/partner/v1/ton-kho?nguon=kho` | Cron theo giờ, chỉ ghi khi `phien_ban` đổi; app LƯU ẢNH CHỤP theo ngày (linh-kien-app ghi đè, không giữ lịch sử) |
| S2 | Tồn + SL xuất của KTV (KTV × mã) | linh-kien-app API `ton-kho?nguon=ktv` (cột `xuat_kho`, `cuoi_ky`) | Như S1. Kỳ của `xuat_kho` = từ đầu kỳ file tới lúc import (xem 6.1) |
| S3 | Danh mục LK (mã, tên, nhóm Karofi/B2B, nhóm thay thế, giá dự phòng) | linh-kien-app `/v1/linh-kien/chi-tiet`, `/v1/lk-thay-the` | Cron hằng ngày |
| S4 | Kho, khu vực, KTV (đang làm / đã khoá), mã MISA | linh-kien-app — **cần làm thêm API** danh bạ (`ktv_lien_he` + `users.bi_khoa` + `khu_vuc` + `kho_cong_ty`) | Cron hằng ngày |
| S5 | Ca DVBH báo thiếu LK | app DVBH — danh sách "Ca thiếu linh kiện" (cần API) | Cron hằng ngày |
| S6 | Hàng đang về (EO, ngày dự kiến) | Hệ thống EO Mua hàng (cần API) | Cron hằng ngày |
| S7 | Sổ chi tiết vật tư (chứng từ × mã × kho × ngày) | **Import trực tiếp trên app này**: mỗi ngày 1 file MISA tổng 30 ngày gần nhất. Sau này EO Mua hàng kéo dữ liệu này từ app | Hằng ngày (tay) |
| S8 | Xuất theo tháng | Tháng cũ: import 1 lần file tĩnh 16 tháng. Tháng mới: tự cộng từ S7; **chốt tĩnh sau 3 tháng** | Tự động |
| S9 | Giá nhập | Import hàng loạt / sửa tay; tạm lấy từ file Google Drive có sẵn; không có → giá dự phòng (S3) kèm nhãn "Tạm dùng giá dự phòng — chưa có giá nhập" | Khi có dữ liệu |
| S10 | Phân loại LK | linh-kien-app; sửa trên app này → đẩy ngược API (xem 6.2) | Hai chiều |

### Quy tắc lưu trữ

- **S7 import:** file phủ khoảng ngày [min, max] → XOÁ dòng cũ trong khoảng đó (theo kho có trong file) rồi
  ghi mới, trong 1 batch → import lại / sửa chứng từ không bị cộng trùng. Giữ S7 tối thiểu 4 tháng.
- **S8 chốt tháng:** tháng M được tính động từ S7 cho tới khi qua 3 tháng (VD 10/2026 chốt vào 01/02/2027),
  khi đó ghi cố định vào bảng xuất theo tháng và không tính lại nữa. Tháng có dữ liệu tĩnh (import) thắng dữ liệu tính.
- **S1/S2 ảnh chụp:** 1 bản/ngày (bản cuối ngày thắng).

## 2. Báo cáo "Đắp chiếu" (thay `0. BC đắp chiếu`)

**[CHỐT]** Tháng N = **tháng hiện tại** (VD 10/2026, lũy kế tới ngày dữ liệu mới nhất). Xuất_k = SL xuất tháng
N−k (k = 0..15) của (nhóm kho, mã). Tồn = ảnh chụp S1 (+ S2 cho "Kho KTV chung") mới nhất.

| Chỉ số | Công thức |
|---|---|
| Phân loại đắp chiếu | `{D nếu Ngành = Điều hòa, ngược lại B}` + 2 chữ số k nhỏ nhất (0..11) có Xuất_k > 0; không có → `12` |
| TB xuất 3 tháng | **[CHỐT]** `ROUNDUP((Xuất_0 + Xuất_1 + Xuất_2) / 3)`, tháng không xuất = 0 |
| TB xuất 6 tháng | **[CHỐT]** `ROUNDUP((Xuất_0 + … + Xuất_5) / 6)` |
| Hệ số dự trữ | Khai báo LK; chưa có → **2** |
| SL dự trữ tiêu chuẩn | `ROUNDUP((TB3 + Xuất_0) / 2 × Hệ số)` |
| Tồn dư | `Tồn − Dự trữ tiêu chuẩn` |
| Xếp loại rủi ro | T5: < 0 · T1: = 0 · T2: ≤ dự trữ/2 · T3: ≤ dự trữ · T4: > dự trữ |
| Giá trị tồn / dự trữ / tồn dư | `Giá nhập (S9) × Tồn / Dự trữ`, hiệu 2 giá trị; dòng dùng giá dự phòng gắn nhãn |

Chế độ gộp kho: Gộp chung · Gộp chung – riêng kho KTV · Gộp chung – không có kho KTV · Tất cả – không gộp.
Lọc: Phân loại đắp chiếu, Phân loại LK, Xếp loại.

> Lưu ý hệ quả của N = tháng hiện tại: đầu tháng Xuất_0 còn nhỏ → dự trữ tiêu chuẩn thấp → ít mã bị T5 hơn
> thực tế; cuối tháng mới đầy đủ. Báo cáo hiển thị rõ "Tháng N lũy kế tới ngày dd/mm".

## 3. Báo cáo "Cảnh báo T5" (thay `0.1`)

= Đắp chiếu, lọc `Xếp loại = T5` và `Phân loại ≠ Thuộc diện cắt mã`; sắp tồn dư tăng dần.

## 4. Báo cáo "Cảnh báo leadtime" (thay `0.2`)

Ngày mốc D = ngày hạch toán mới nhất trong S7. **[CHỐT]** `TH_d` = tổng SL xuất S7 trong `(D − d, D]`,
d ∈ {7, 14, 30}, MỌI loại xuất (kể cả trả hàng, điều chuyển). Tồn = S1 theo mã + kho.

| Chỉ số | Công thức |
|---|---|
| Số ngày dư (mỗi d) | **[CHỐT]** `Tồn / (TH_d / d) − d − Leadtime`; leadtime chưa khai báo → **3** |
| Mức cảnh báo | Tồn + TH_d = 0 → 5. Hết tồn – không tiêu hao · TH_d = 0 → 6. Còn tồn – không tiêu hao · < −3 → 1. Thiếu nghiêm trọng · < 0 → 2. Thiếu hàng · ≤ 2 → 3. Tới thời điểm đặt hàng · còn lại → 4. Bình thường |
| TB tiêu hao/ngày | `(TH_7/7 + TH_14/14 + TH_30/30) / 3` |
| Tồn chuẩn | `TB/ngày × Hệ số NK × 30`; hệ số chưa khai báo → **3** |
| SL thiếu cần đặt | `Tồn chuẩn − Tồn − Hàng đang về (S6)` (trừ hàng đang về khi S6 có) |
| Tần suất | TH_30 ≤ 5 Ít · (≥100, ≥50, ≥20) Nhiều · (≥30, ≥14, ≥7) Đều · còn lại Khác |
| Dự trữ / Tồn dư | Từ Đắp chiếu, cùng mã + cùng kho |
| DVBH báo thiếu | Số ca từ S5 |

## 5. Báo cáo "LK thu hồi DVBH" (thay `0.5`)

Mỗi (kho KTV, mã) từ S2: `Xuất`, `Tồn`. Thông tin kho từ S4.

| Bước | Công thức |
|---|---|
| Thông tin kho | **[CHỐT]** Kho không có trong S4 → vẫn tính theo tên kho, coi "Làm", Phòng ban/Khu vực = "Chưa khai báo", liệt kê để bổ sung |
| Hệ số tồn | Theo Phân loại LK; **[CHỐT]** chưa có phân loại → "Chưa cài đặt", hệ số 0 |
| Tồn chuẩn | `ROUNDUP(Xuất / Số_kỳ_2_tuần × Hệ số)` — xem 6.1 |
| Phân nhóm | Không "Làm" → Nhóm 1 · Tồn > 0 và Xuất = 0 (kể cả trống) → Nhóm 2 · Tồn > Tồn chuẩn → Nhóm 3 · còn lại → Nhóm 4 |
| Đánh giá | Ma trận Phân loại × Nhóm (settings) |
| Báo cáo | Tổng SL tồn theo Phân loại × Nhóm 1–4, lọc Phòng ban + Khu vực, kiểm tra khớp tổng S2 |

## 6. Quyết định bổ sung (chốt 29/10/2026) + khác biệt có chủ đích so với Sheet

- **Kỳ xuất của KTV:** dữ liệu cũ lưu tĩnh, dữ liệu mới định kỳ lưu vết — mỗi lần linh-kien-app có phiên tồn kho mới, app lưu
  1 phiên (`ton_kho_phien`, kèm `ky_tu_ngay`/`ky_den_ngay` của file). Tồn chuẩn thu hồi chia cho `số ngày của kỳ / 14`; không
  biết kỳ → tham số `so_ky_2_tuan_mac_dinh` (12, như Sheet).
- **Phân loại LK:** khai báo trong Cài đặt của app này (nhân sự tự bổ sung), KHÔNG dùng cột "Phân loại đặc thù" của
  linh-kien-app (cột đó chỉ lưu được khi bật cờ Đặc thù — cờ quyết định bước TBP duyệt đơn).
- **Tháng N:** tháng hiện tại (lũy kế). Sheet từng lệch tháng do hàm ở "2.2. Filter xuất trong tháng" kéo thiếu — đã sửa bên Sheet.
- **Giá nhập:** import / sửa tay; chưa có → giá dự phòng từ linh-kien-app, gắn nhãn "Tạm dùng giá dự phòng".
- Khác Sheet (có chủ đích): TB 3/6 tháng chia cố định (Sheet `AVERAGEA` bỏ ô trống); LK có dòng khai báo nhưng để TRỐNG hệ số /
  leadtime → dùng mặc định (Sheet `VLOOKUP` trả ô trống = 0); xuất trống ở thu hồi = 0 → vào Nhóm 2 (Sheet không bao giờ ra Nhóm 2);
  số lượng đọc thành số khi import (Sheet đọc "6.11" thành ngày).

### Đối chiếu đã làm (test/tinhToan.test.ts + chạy thử local 29/10/2026)

- Phân loại đắp chiếu: khớp 3.546/3.546 dòng `3.1. Pivot`; xếp loại T1–T5 khớp 100% khi cùng dự trữ / tồn dư.
- Leadtime: 2.075 dòng `0.2.2.` (mọi dòng mức 1–4 + 300 dòng mẫu) khớp mức cảnh báo 7/14/30, TB/ngày, tồn chuẩn, tần suất.
- Xuất theo tháng import từ `1.1. Data kho Cũ`: tổng từng tháng khớp `3. Ghép` (VD 06/2026 = 76.545,75) khi các kho đúng loại.

## 7. Settings

- **Theo LK** (bổ sung trên danh mục đồng bộ S3): Phân loại LK (6.2), Ngành, Nơi SX (SX/NK), Hệ số dự trữ,
  Leadtime, Đối tác, Giá nhập.
- **Theo kho KTV ngoài danh bạ S4:** Làm việc, Phòng ban, Khu vực.
- **Tham số chung:** hệ số thu hồi theo phân loại; ma trận Phân loại × Nhóm → hành động; mặc định (hệ số 2 /
  3, leadtime 3, phân loại "Chưa cài đặt" = 0); ngưỡng T1–T5, leadtime (−3/0/2), tần suất (5/30/100…);
  số tháng chốt tĩnh (3); danh sách kho công ty + cách gộp.

## 8. Màn hình

Tổng quan · Đắp chiếu · Cảnh báo T5 · Cảnh báo leadtime · Thu hồi DVBH · Import (S7 hằng ngày, S8 tĩnh, S9 giá,
lịch sử import + mốc dữ liệu) · Cài đặt (mục 7 + danh sách kho/LK chưa khai báo).

## 9. Đối chiếu khi chuyển đổi

Tổng xuất tháng = tổng S7/S8 cùng tháng; tổng tồn = S1 + S2; chạy song song Sheet 1 kỳ — các chỉ số không dính
lỗi Sheet (đắp chiếu, tiêu hao 7/14/30, tần suất) khớp từng dòng, các chỉ số dính lỗi được giải trình.
