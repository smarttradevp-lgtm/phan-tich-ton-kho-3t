# Kế hoạch: app "Phân tích tồn kho 3T" làm kho dữ liệu MISA gốc

Chốt hướng 2026-10-30: mọi file MISA (tồn kho, sổ chi tiết vật tư, xuất tháng, phiếu nhập) **chỉ nhập 1 lần ở app này**. Các
hệ thống khác (linh-kien-app, DVBH, EO Mua hàng) **kéo về qua API, giữ bản sao của mình** và giữ nguyên logic nghiệp vụ của mình.
Không hệ thống nào gọi app này *trong lúc* xử lý nghiệp vụ (tạo đơn, tự duyệt) — chỉ kéo khi có phiên bản mới.

Viết tắt: **Hub** = app Phân tích tồn kho 3T · **LK** = linh-kien-app · **EO** = app EO Mua hàng.

---

## 1. Hiện trạng (đọc từ code ngày 2026-10-30)

| Dữ liệu MISA | Nhập ở đâu | Bảng | Ai đọc |
|---|---|---|---|
| Tồn kho công ty + kho KTV (file "Tổng hợp tồn kho") | LK — Kế toán, `POST /api/settings/ktv-ton-kho/import` | `ktv_ton_kho`, `kho_cong_ty_ton_kho` (GHI ĐÈ, không lịch sử) + mốc `app_settings.ktv_ton_kho_import_meta` | LK (tự duyệt, tồn khả dụng, công nợ, TRỪ CÔNG NỢ, dự phòng), DVBH (`/v1/ton-kho`), Hub (`/v1/ton-kho`) |
| Sổ chi tiết vật tư (30 ngày) | Hub | `so_chi_tiet` | Hub (leadtime, xuất tháng) |
| Xuất kho theo tháng (tĩnh) | Hub | `xuat_thang` | Hub (đắp chiếu) |
| Phiếu nhập (hàng về thực tế) | EO tự nhập | `amis_receipt` (bên EO) | EO → DVBH |

Điểm then chốt ở LK cần giữ nguyên nghĩa khi đổi nguồn:

1. **Phân loại dòng lúc nhập** (`routes/ktvTonKho.ts` POST /import): `ma_kho` khớp `ktv_lien_he.ma_misa` → dòng kho KTV
   (`ma_ktv`); khớp `kho_cong_ty.ma` → kho công ty; còn lại → kho KTV với `ma_ktv` NULL ("mã kho chưa khớp").
2. **Mốc nhập** = `app_settings.ktv_ton_kho_import_meta.updated_at`. Dùng làm mốc "đơn tạo SAU lần nhập" ở `tonKhoCongTy.ts`
   (giữ hàng), `congNoKtv.ts` (công nợ phát sinh / đã trừ), `tonKhoKtv.ts` (TRỪ CÔNG NỢ), `duPhongKtv.ts`, `linhKienLienQuan.ts`,
   và là `phien_ban` của API đối tác `/v1/ton-kho/meta` (DVBH, Hub đang kéo theo nó).
3. **Sau khi nhập**: `tuDongXacNhanHangVe()` (tự xác nhận hàng về cho ticket thiếu hàng theo ưu tiên).

---

## 2. Kiến trúc đích

```
Kế toán ──(file MISA)──► HUB  ── lưu theo PHIÊN (giữ lịch sử) ──► API đối tác GET (theo phiên bản, phân trang)
                          │                                            ▲          ▲            ▲
                          └─ báo "có phiên mới" (Service Binding) ─►  LK         DVBH*        EO*
                                                                   kéo về bản sao, chạy logic riêng
```
\* DVBH giữ nguyên nguồn từ LK ở giai đoạn đầu (không phải sửa DVBH). EO cần người phụ trách repo EO.

Nguyên tắc:
- **Hub lưu dữ liệu THÔ** đúng như file (mã kho, mã hàng, tên, ĐVT, đầu kỳ, nhập, xuất, cuối kỳ, kỳ báo cáo). Không đưa logic
  nghiệp vụ của LK sang Hub. Việc phân loại kho KTV / kho công ty theo danh bạ LK vẫn do LK làm trên dòng thô kéo về.
- **Phiên bản** = thời điểm phiên nhập hoàn tất ở Hub (`xong_luc`, giờ VN). LK ghi đúng giá trị này vào mốc nhập của mình →
  mốc "đơn sau lần nhập" giữ nguyên nghĩa (vẫn là lúc Kế toán nhập file, không phải lúc LK kéo về).
- **Kéo, không gọi trực tiếp**: LK giữ bản sao trong D1 của mình; Hub lỗi thì LK vẫn chạy với tồn cũ (giống hôm nay khi Kế toán
  chưa kịp nhập).
- **Báo ngay + kéo định kỳ dự phòng**: Hub nhập xong gọi LK qua Service Binding để LK kéo liền; LK vẫn tự kiểm tra phiên bản mỗi
  giờ (8h–18h T2–T7) phòng khi lần báo bị lỡ.

---

## 3. Việc cần làm

### 3.1. Hub (repo này)

| # | Việc | Ghi chú |
|---|---|---|
| H1 | Migration: `ton_kho` thêm `ten_kho`, `dvt`; importer đọc thêm cột ĐVT, Tên kho | LK đang lưu 2 cột này |
| H2 | Bảng `doi_tac_api_key` (băm SHA-256, tên bên dùng, quyền đọc tập dữ liệu nào, lần dùng cuối, bật/tắt) + màn Quản trị › Khoá API | cùng cơ chế `X-API-Key` của LK / DVBH; mỗi bên 1 khoá riêng |
| H3 | API đọc `GET /api/doi-tac/v1/misa/ton-kho/meta` → `{phien_ban, ky_tu_ngay, ky_den_ngay, so_dong, ten_file}` | chỉ phiên `xong` mới nhất |
| H4 | `GET /api/doi-tac/v1/misa/ton-kho?phien_ban=&after=&limit=` — dòng thô, con trỏ theo rowid, ≤ 2000/trang; phiên bản đổi giữa chừng → 409 `PHIEN_BAN_DA_DOI` | bên kéo bắt đầu lại |
| H5 | `GET /v1/misa/so-chi-tiet?tu=&den=&ma_kho=&ma=&after_id=` + `/v1/misa/xuat-thang?thang=` + `/v1/misa/phieu-nhap?tu=&den=` (sổ chi tiết lọc dòng nhập, chứng từ PNK) | cho EO / báo cáo khác (giai đoạn 3) |
| H6 | Giới hạn tần suất theo khoá (vd 120 req/phút), không ghi D1 mỗi lần gọi (chỉ cập nhật "lần dùng cuối" tối đa 1 lần / 10 phút) | giữ chi phí ghi D1 thấp |
| H7 | Báo phiên mới: sau lô cuối nhập tồn → `waitUntil` gọi `POST /api/hub-misa/thong-bao` của LK (Service Binding `LINHKIEN_SERVICE`, header `X-Sync-Key` = secret chung `HUB_SYNC_KEY`) | lỗi thì bỏ qua — LK có cron dự phòng |
| H8 | Khi Hub là nguồn: tắt kéo tồn kho từ LK (`dongBoTonKho`) — chỉ giữ kéo danh mục / danh bạ | tránh vòng: Hub nhập → LK kéo → Hub kéo lại |
| H9 | Màn Quản trị › **Đối chiếu 2 phiên tồn kho**: tổng cuối kỳ theo kho, số mã, danh sách dòng lệch (mã kho × mã hàng) | dùng trong giai đoạn chạy song song |
| H10 | Vai trò cho Kế toán: dùng `nhap_lieu` (nhập file + sửa cài đặt). Nếu cần "chỉ nhập file MISA, không sửa cài đặt" → thêm vai trò `ke_toan` (migration đổi CHECK của `users`) | **cần chốt** (mục 6) |
| H11 | Màn Nhập dữ liệu: ô "Tồn kho" ghi rõ "nguồn cho linh-kien-app / DVBH", hiện trạng thái các bên đã kéo phiên mới chưa (từ "lần dùng cuối" của khoá) | để Kế toán biết đã xong |

### 3.2. linh-kien-app

| # | Việc | Ghi chú |
|---|---|---|
| L1 | Tách phần ghi 1 lô dòng tồn (phân loại KTV / kho công ty / chưa khớp → bảng `_tam`) và phần "chốt" (thay bảng thật + ghi meta + `tuDongXacNhanHangVe`) ở `routes/ktvTonKho.ts` thành hàm trong `lib/` | dùng chung cho import file (giữ làm dự phòng) và kéo từ Hub — 1 logic duy nhất |
| L2 | `lib/hubMisa.ts`: kéo meta → so với meta đang có → kéo hết trang vào bảng `_tam` → chốt; ghi meta với `updated_at` = **`phien_ban` của Hub**, `updated_by` = "Hub MISA", giữ `ky_tu_ngay/ky_den_ngay/so_dong` | phiên bản đổi giữa chừng → bỏ, chờ lần sau |
| L3 | Route `POST /api/hub-misa/thong-bao` (X-Sync-Key, chỉ qua Service Binding) → chạy L2 trong `waitUntil`; thêm vào `LA_API_DOI_TAC` (`lib/baoVe.ts`) | giống `/api/suachua-partner` |
| L4 | Cron: mỗi giờ 8h–18h T2–T7 kiểm tra meta Hub, đổi thì kéo (gắn vào cron sẵn có) | dự phòng khi lần báo bị lỡ |
| L5 | Cờ `app_settings.nguon_ton_kho` = `file` \| `hub_thu` \| `hub`: `file` = như hôm nay; `hub_thu` = kéo vào **bảng bóng** (`*_hub`) chỉ để đối chiếu, không ảnh hưởng nghiệp vụ; `hub` = kéo vào bảng thật, nút Import file chỉ Admin thấy (dự phòng) | Admin đổi ở Cài đặt; quay lại `file` bất cứ lúc nào |
| L6 | Màn Cài đặt › Tồn kho: hiện nguồn, phiên bản Hub mới nhất, lần kéo cuối, lỗi gần nhất, nút "Kéo ngay" | |
| L7 | Secrets: `HUB_API_KEY` (khoá đọc do Hub cấp), `HUB_SYNC_KEY`; Service Binding `HUB_SERVICE` → Worker `phantichtonkho` | |
| L8 | Bump `APP_VERSION`, cập nhật `CLAUDE.md` (mốc nhập giờ đến từ Hub khi `nguon_ton_kho = hub`) | quy ước repo LK |

API đối tác của LK (`/v1/ton-kho`, `/v1/ton-kho/meta`) **giữ nguyên** → DVBH không phải sửa gì; `phien_ban` vẫn đổi đúng lúc có phiên mới.

### 3.3. DVBH, EO

- **DVBH**: không đổi ở giai đoạn 1–2 (vẫn kéo từ LK). Có thể chuyển sang Hub sau, khi cần dữ liệu thô / lịch sử.
- **EO Mua hàng**: giai đoạn 3 — EO kéo phiếu nhập từ Hub (`/v1/misa/phieu-nhap`) thay vì tự nhập `amis_receipt`. Repo EO không
  nằm trong phiên làm việc này → cần người phụ trách xác nhận định dạng đang dùng.

---

## 4. Lộ trình

| Giai đoạn | Nội dung | Điều kiện qua giai đoạn |
|---|---|---|
| **0. Chuẩn bị** (Hub: H1–H9, H11; LK: L1–L7 với cờ = `file`) | Deploy cả 2 app, chưa đổi gì với người dùng LK. Hub đang dùng tồn kéo từ LK như cũ | Build/typecheck, chạy thử local với dữ liệu thật đã nhập |
| **1. Chạy song song** (2–4 tuần) | Kế toán nhập file tồn ở **cả LK (như cũ) và Hub**. LK đặt cờ `hub_thu` → kéo vào bảng bóng. Mỗi ngày đối chiếu: Hub (H9) so phiên nhập Hub với phiên kéo từ LK; LK so bảng bóng với bảng thật | **10 ngày làm việc liên tiếp không lệch** (hoặc lệch có giải thích: Kế toán nhập khác file) |
| **2. Chuyển nguồn** | LK đặt cờ `hub`. Kế toán chỉ nhập ở Hub. Hub bật H8 (thôi kéo tồn từ LK). Theo dõi 1 tuần: mốc nhập, tự duyệt, hàng về tự động, API DVBH | Nếu sự cố: LK đổi cờ về `file`, Kế toán nhập lại ở LK (mất ~5 phút) |
| **3. Mở rộng** | API sổ chi tiết / xuất tháng / phiếu nhập cho EO và bên khác; cân nhắc DVBH kéo thẳng Hub; tìm hiểu API MISA AMIS để bỏ bước nhập file | Theo từng bên dùng |

---

## 5. Rủi ro & cách xử lý

| Rủi ro | Xử lý |
|---|---|
| Hub lỗi / chậm đúng lúc Kế toán cần nhập | LK vẫn chạy với tồn cũ; cờ `file` + nút Import dự phòng (Admin) |
| LK kéo trễ sau khi nhập → đơn được duyệt theo tồn cũ | Báo ngay qua Service Binding (H7/L3) + cron mỗi giờ; mốc nhập lấy theo Hub nên đơn tạo trong lúc chờ vẫn được tính "sau mốc" |
| Mốc nhập đổi nghĩa → công nợ / giữ hàng lệch | L2 ghi `updated_at` = `phien_ban` Hub (= lúc Kế toán nhập), không dùng giờ kéo |
| Phân loại kho lệch giữa 2 app (Hub theo `kho.loai`, LK theo Mã MISA KTV) | Hub chỉ cung cấp dữ liệu thô; LK tự phân loại như hôm nay. Màn Kho của Hub nên khớp theo Mã MISA (đã nêu ở danh sách việc còn chờ) |
| Phụ thuộc vòng: Hub cần danh bạ từ LK, LK cần tồn từ Hub | Danh bạ kéo hằng đêm + nút "Đồng bộ ngay"; KTV mới thì đồng bộ danh bạ trước rồi mới nhập tồn (ghi vào hướng dẫn Kế toán) |
| Chi phí đọc D1 khi nhiều bên kéo | Chỉ kéo khi phiên bản đổi, phân trang con trỏ, giới hạn tần suất theo khoá |
| Mẫu xuất MISA đổi tên cột → nhập hỏng | Bộ nhận cột theo tiêu đề + bước xem trước của Hub báo ngay khi thiếu cột; không chốt phiên khi lỗi |
| Lộ dữ liệu kho toàn công ty | Khoá API riêng từng bên, thu hồi được; **chuyển repo GitHub sang Private** |

---

## 6. Cần chốt trước khi làm

1. Kế toán dùng vai trò **Nhập liệu** sẵn có ở Hub, hay cần vai trò riêng chỉ nhập file MISA (H10)?
2. Giữ nút Import file ở LK làm **dự phòng chỉ Admin** khi đã chuyển nguồn (khuyến nghị: giữ)?
3. Người phụ trách repo **EO Mua hàng** để làm giai đoạn 3 (phiếu nhập)?
4. Cả 3 Worker (`phantichtonkho`, `linhkien`, `dvbh`) cùng tài khoản Cloudflare → dùng Service Binding (gọi nhau qua `*.workers.dev`
   bị chặn). Xác nhận tài khoản.
