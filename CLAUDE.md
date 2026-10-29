# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dự án

"Phân tích tồn kho 3T" — thay Google Sheet "BC tồn kho 3T" bằng app Cloudflare Workers + D1. 4 báo cáo: **Đắp chiếu**,
**Cảnh báo T5**, **Cảnh báo leadtime**, **LK thu hồi DVBH**. Logic + mọi quyết định nghiệp vụ đã chốt nằm ở
`docs/DAC_TA_LOGIC.md` — đọc file đó trước khi sửa bất kỳ công thức nào. Cùng stack với `linh-kien-app` (repo riêng, nguồn
dữ liệu chính của app này).

## Commands

```bash
npm install
npm run dev:worker        # wrangler dev, port 8790 (linh-kien-app dùng 8788)
npm run dev:frontend      # vite, port 5176, proxy /api -> 8790
npm run build             # build frontend (Worker phục vụ frontend/dist)
npm test                  # bộ tính toán (node:test, không cần D1)
npm run typecheck         # backend + frontend
npm run db:migrate:local  # áp migrations/ vào .wrangler/state
npm run db:migrate:remote # D1 THẬT
npm run deploy            # build + wrangler deploy (Worker THẬT)
```

Chạy 1 test: `cd backend && node --experimental-strip-types --test --test-name-pattern "Leadtime" test/tinhToan.test.ts`.

Dev local cần `.dev.vars` (gitignored) với `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINHKIEN_API_KEY`.
Đăng nhập Google không chạy trên localhost → tạo user trong D1 local và tự ký cookie `ptk_session` (JWT HS256, payload
`{email, pv: 0, iat, exp}`, xem `backend/src/lib/jwt.ts`).

## Kiến trúc

1 Worker (Hono) phục vụ `/api/*` + frontend tĩnh; `assets.run_worker_first: ["/api/*"]` là bắt buộc (bài học linh-kien-app).

- **Bộ tính toán thuần** `backend/src/lib/tinhToan/` (`dapChieu.ts`, `leadtime.ts`, `thuHoi.ts`, `chung.ts`, `thamSo.ts`) —
  không đụng D1, import bằng đuôi `.ts` để `node --test` chạy trực tiếp. Test đối chiếu với số liệu thật của Sheet
  (`backend/test/fixtures/*.json`). Đổi công thức → sửa ở đây + cập nhật test + `docs/DAC_TA_LOGIC.md`.
- **`lib/duLieuBaoCao.ts`** — đọc D1 → đầu vào cho bộ tính. Báo cáo tính LÚC ĐỌC, không lưu kết quả.
  - Xuất theo tháng = `xuat_thang` (tĩnh: import tay hoặc hệ thống chốt) cho tháng đã có, còn lại cộng động từ `so_chi_tiet`
    (`docXuatThang`). Tháng N = tháng hiện tại giờ VN.
  - Tồn = phiên `ton_kho_phien` mới nhất trạng thái `xong`.
  - `kho.loai` quyết định kho vào đâu: `cong_ty`/`khac` = kho riêng; `ktv` = gộp "Kho KTV chung" + báo cáo thu hồi;
    `bo_qua` = loại hẳn. Xuất của kho `ktv` KHÔNG tính vào đắp chiếu (như Sheet).
  - Cột `*_tay` của `kho` (nhập tay / import) THẮNG cột đồng bộ.
- **Tham số** (hệ số mặc định, ngưỡng, cửa sổ ngày…) là 1 JSON ở `app_settings.tham_so`, đọc qua `docThamSo()` (thiếu khoá →
  mặc định). Thêm tham số: thêm vào `ThamSo` + `THAM_SO_MAC_DINH` + nhãn ở `frontend/src/pages/CaiDat.tsx` (`NHAN_THAM_SO`).
- **Import** (`routes/importDuLieu.ts`): trình duyệt đọc Excel (`frontend/src/lib/importers.ts`, nhận cột theo tiêu đề bỏ
  dấu), gửi lô ≤ 1000 dòng vào bảng `*_tam`; lô cuối thay dữ liệu thật trong 1 batch. Sổ chi tiết: xoá đúng khoảng
  `[min, max]` ngày của file theo các kho có trong file rồi chèn lại → import lại không cộng trùng. Xuất tháng: thay toàn bộ
  các tháng có trong file. Khai báo LK: ô trống = giữ giá trị cũ.
- **Đồng bộ linh-kien-app** (`lib/dongBoLinhKien.ts`, header `X-API-Key`, qua Service Binding `LINHKIEN_SERVICE` nếu có):
  `/v1/ton-kho/meta` + `/v1/ton-kho` (chỉ kéo khi `phien_ban` đổi; đổi giữa chừng → huỷ phiên), `/v1/linh-kien/danh-sach`,
  `/v1/danh-ba-kho`. 3 API sau được thêm ở linh-kien-app nhánh `claude/api-phan-tich-ton-kho` — phải deploy linh-kien-app
  trước. Cron mỗi giờ: tồn kho; 18h UTC (1h VN): danh mục + danh bạ + `chotThangTinh()` (tháng đã qua
  `so_thang_chot_tinh` tháng → ghi tĩnh vào `xuat_thang` nguồn `chot`).
- **Nguồn chưa có API**: `dvbh_thieu_lk` (ca DVBH báo thiếu) và `hang_dang_ve` (EO Mua hàng) đã có bảng + đã nối vào báo cáo
  leadtime, nhưng chưa có code đồng bộ.
- **Auth**: Google OAuth, cookie `ptk_session` 72h trượt; `users.vai_tro` = `admin` | `nhap_lieu` | `xem`, tài khoản mới
  `cho_duyet`; `BOOTSTRAP_ADMIN_EMAIL` tự thành admin. Khoá tài khoản tăng `phien_ban_phien` = thu hồi mọi phiên.
  Request ghi phải cùng origin (`index.ts`).

## Quy ước

- Thời gian lưu giờ VN `YYYY-MM-DD HH:MM:SS`; ngày `YYYY-MM-DD`; tháng `YYYYMM`.
- Danh sách tham số truyền vào SQL bằng 1 bind JSON (`json_each`) — D1 giới hạn 100 tham số/câu.
- Comment code tiếng Việt không dấu (như linh-kien-app); giao diện tiếng Việt có dấu.
