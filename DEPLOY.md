# Triển khai lần đầu

> Hướng dẫn chi tiết từng bước (kèm câu lệnh giao cho Claude trên máy): `docs/HUONG_DAN_TRIEN_KHAI.md`.

Chưa có tài nguyên Cloudflare / Google thật. Làm theo thứ tự:

1. **linh-kien-app**: deploy `master` (≥ v1.421, đã gộp nhánh `claude/api-phan-tich-ton-kho`: thêm `/v1/linh-kien/danh-sach`, `/v1/danh-ba-kho`,
   `/v1/ton-kho` trả thêm `dau_ky/nhap_kho/xuat_kho`). Tạo 1 khoá API đối tác cho "Phân tích tồn kho 3T" (Admin linh-kien-app ›
   Partner API keys) — lưu lại khoá.
2. **D1**: `npx wrangler d1 create phan-tich-ton-kho-db` → điền `database_id` vào `wrangler.jsonc`, rồi `npm run db:migrate:remote`.
3. **Google OAuth Client** (Web): redirect URI `https://phantichtonkho.dichvu3t.workers.dev/api/auth/callback` (sửa
   `GOOGLE_REDIRECT_URI` / `FRONTEND_URL` trong `wrangler.jsonc` nếu đổi tên Worker).
4. **Service Binding**: bỏ comment khối `services` (`LINHKIEN_SERVICE` → Worker `linhkien`, `DVBH_SERVICE` → Worker `dvbh`)
   trong `wrangler.jsonc`.
4b. **app DVBH** (cho "Hồ sơ linh kiện" › Ca DVBH đang báo thiếu, API `GET /api/partner/thieu-linh-kien` đã có sẵn bên DVBH):
   Admin DVBH tạo 1 khoá API đối tác cho "Phân tích tồn kho 3T" — lưu lại khoá. Không có khoá thì thẻ đó hiện "chưa kết nối".
5. **Secrets**:
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET      # chuỗi ngẫu nhiên >= 32 ký tự
   npx wrangler secret put LINHKIEN_API_KEY    # khoá ở bước 1
   npx wrangler secret put DVBH_API_KEY        # khoá ở bước 4b (tuỳ chọn)
   npx wrangler secret put HUB_SYNC_KEY        # chuỗi ngẫu nhiên, đặt GIỐNG HỆT bên linh-kien-app (báo phiên tồn kho mới)
   ```
6. `npm run deploy`.
7. Đăng nhập bằng `BOOTSTRAP_ADMIN_EMAIL` → **Nhập & đồng bộ**:
   - "Đồng bộ ngay" (danh mục LK, danh bạ kho / KTV, tồn kho).
   - Cài đặt › Kho: kiểm tra loại kho (kho công ty / KTV / khác / bỏ qua).
   - Import lần đầu: file xuất tháng tĩnh (sheet "1.1. Data kho Cũ"), khai báo LK (sheet "3. Khai báo linh kiện"), thông tin
     kho KTV (sheet "4.3. Cài đặt kho"), giá nhập (file Google Drive), sổ chi tiết vật tư 30 ngày.
8. Chạy song song với Google Sheet 1 kỳ, đối chiếu theo `docs/DAC_TA_LOGIC.md` mục 9.

## Kho dữ liệu MISA (app này là nơi nhập MISA gốc)

Kế hoạch + lộ trình 4 giai đoạn: `docs/KE_HOACH_KHO_MISA.md`; tài liệu API cho các bên: `docs/API_DOI_TAC_MISA.md`.
1. Quản trị › Kho dữ liệu MISA › **Tạo khoá** cho linh-kien-app (quyền Tồn kho) → đặt vào secret `HUB_API_KEY` bên linh-kien-app.
2. Đặt `HUB_SYNC_KEY` giống nhau ở 2 Worker; bên linh-kien-app thêm Service Binding `HUB_SERVICE` → Worker `phantichtonkho`.
3. Giai đoạn chạy song song: linh-kien-app đặt nguồn tồn = "Thử (bảng bóng)"; Kế toán nhập file tồn ở CẢ 2 app; mỗi ngày
   Quản trị › Dữ liệu hệ thống › **Đối chiếu 2 phiên tồn kho** (phiên File Excel vs phiên linh-kien-app).
4. Chuyển nguồn: linh-kien-app đặt nguồn = "App Phân tích tồn kho"; app này bật "App này là nguồn tồn kho".
