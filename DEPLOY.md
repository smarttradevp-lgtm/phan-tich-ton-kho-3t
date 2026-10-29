# Triển khai lần đầu

Chưa có tài nguyên Cloudflare / Google thật. Làm theo thứ tự:

1. **linh-kien-app**: merge + deploy nhánh `claude/api-phan-tich-ton-kho` (thêm `/v1/linh-kien/danh-sach`, `/v1/danh-ba-kho`,
   `/v1/ton-kho` trả thêm `dau_ky/nhap_kho/xuat_kho`). Tạo 1 khoá API đối tác cho "Phân tích tồn kho 3T" (Admin linh-kien-app ›
   Partner API keys) — lưu lại khoá.
2. **D1**: `npx wrangler d1 create phan-tich-ton-kho-db` → điền `database_id` vào `wrangler.jsonc`, rồi `npm run db:migrate:remote`.
3. **Google OAuth Client** (Web): redirect URI `https://phantichtonkho.dichvu3t.workers.dev/api/auth/callback` (sửa
   `GOOGLE_REDIRECT_URI` / `FRONTEND_URL` trong `wrangler.jsonc` nếu đổi tên Worker).
4. **Service Binding**: bỏ comment khối `services` (`LINHKIEN_SERVICE` → Worker `linhkien`) trong `wrangler.jsonc`.
5. **Secrets**:
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET      # chuỗi ngẫu nhiên >= 32 ký tự
   npx wrangler secret put LINHKIEN_API_KEY    # khoá ở bước 1
   ```
6. `npm run deploy`.
7. Đăng nhập bằng `BOOTSTRAP_ADMIN_EMAIL` → **Nhập & đồng bộ**:
   - "Đồng bộ ngay" (danh mục LK, danh bạ kho / KTV, tồn kho).
   - Cài đặt › Kho: kiểm tra loại kho (kho công ty / KTV / khác / bỏ qua).
   - Import lần đầu: file xuất tháng tĩnh (sheet "1.1. Data kho Cũ"), khai báo LK (sheet "3. Khai báo linh kiện"), thông tin
     kho KTV (sheet "4.3. Cài đặt kho"), giá nhập (file Google Drive), sổ chi tiết vật tư 30 ngày.
8. Chạy song song với Google Sheet 1 kỳ, đối chiếu theo `docs/DAC_TA_LOGIC.md` mục 9.
