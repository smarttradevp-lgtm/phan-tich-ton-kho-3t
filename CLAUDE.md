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
Đăng nhập Google không chạy trên localhost → thêm `DEV_LOGIN=1` vào `.dev.vars` rồi mở
`http://localhost:8790/api/auth/dev-login[?email=...]` (tạo admin đã duyệt + ký cookie). Route này chỉ bật khi có biến đó VÀ host
là localhost — KHÔNG bao giờ đặt `DEV_LOGIN` ở `wrangler.jsonc` / secrets thật.

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
- **Import tồn kho từ Excel** (`POST /import/ton-kho`, file MISA "Tổng hợp tồn kho"): thay tạm đồng bộ linh-kien-app khi API chưa
  triển khai. Mỗi file = 1 `ton_kho_phien` `nguon='import'` (migration 0002); lô đầu tạo phiên `dang_keo`, các lô ghi thẳng `ton_kho`,
  lô cuối đánh dấu `xong` + kỳ (từ/đến ngày do người nhập chọn). Kho loại `ktv` → dòng nguồn `ktv`; mã kho mới → thêm `kho` loại `khac`.
- **Quản trị** (`routes/quanTri.ts`, chỉ admin): đếm dòng từng bảng, danh sách phiên tồn (xoá phiên cũ, không xoá phiên đang
  dùng), dọn sổ chi tiết trước ngày X (CHỈ tháng đã có `xuat_thang` tĩnh), xoá xuất tháng tĩnh 1 tháng, nhật ký. Mọi thao tác
  cài đặt / người dùng / dọn dữ liệu ghi `nhat_ky` qua `lib/nhatKy.ts` (`lenhNhatKy` — gộp vào batch của thao tác chính).
- **Phân loại so khớp không phân biệt hoa/thường** (`khoaPhanLoai` ở `duLieuBaoCao.ts`): khai báo viết khác hoa/thường được quy
  về tên chuẩn trong `phan_loai_lk`; tên không có trong danh sách hiện ở Cài đặt › Phân loại (gộp qua `POST /cai-dat/phan-loai/gop`).
- **Tổng quan** (`GET /bao-cao/tong-quan`) tính lại cả 3 báo cáo mỗi lần gọi + kiểm tra chất lượng dữ liệu; chi tiết 1 LK
  (`GET /bao-cao/lk/:ma`) dùng chung drawer `components/ChiTietLk.tsx` (`useMoLk()`) cho mọi bảng báo cáo.
- **Frontend**: hash routing (`#/cai-dat/lk`, `#/quan-tri/du-lieu`…), menu ở `App.tsx` (`NHOM`). Bảng dùng chung `Bang` (tìm không
  dấu, bấm tiêu đề sắp xếp theo `Cot.sx`, chọn nhiều dòng; mobile → dạng thẻ theo `Cot.the`). **Lọc cột kiểu Excel**: `Cot.loc`
  = `"gt"` (chọn nhiều giá trị, theo `Cot.gt` hoặc `sx`, có số đếm tính trên dữ liệu đã lọc bởi cột khác) | `"so"` (khoảng từ/đến);
  key lọc = `Cot.ten` nên giữ tên cột ổn định. Tổng / Excel của trang phải lấy danh sách SAU lọc qua `onLoc` (Excel dùng
  `cotXuat`/`giaTriXuat`). **Bộ lọc nằm trên URL** (`lib/dieuHuong.ts` `useUrlState`, hash `#/trang?khoa=...`): mọi bộ lọc đầu
  trang + tìm / sắp xếp / lọc cột của `Bang` có `idUrl` → gửi link giữ nguyên cách xem; lưu thêm localStorage theo trang để bấm
  menu quay lại vẫn còn; "Xoá lọc" = `xoaLocTrang()` (dựng lại trang). Biểu đồ tự dựng `components/bieuDo.tsx` (1 chuỗi = màu primary, đỏ chỉ
  cho mức nguy cơ). Chưa có giá nhập lẫn dự phòng → Tổng quan / Đắp chiếu tự hiển thị theo số lượng thay vì giá trị.
- **Nguồn chưa có API**: `dvbh_thieu_lk` (ca DVBH báo thiếu) và `hang_dang_ve` (EO Mua hàng) đã có bảng + đã nối vào báo cáo
  leadtime, nhưng chưa có code đồng bộ.
- **Auth**: Google OAuth, cookie `ptk_session` 72h trượt; `users.vai_tro` = `admin` | `nhap_lieu` | `xem`, tài khoản mới
  `cho_duyet`; `BOOTSTRAP_ADMIN_EMAIL` tự thành admin. Khoá tài khoản tăng `phien_ban_phien` = thu hồi mọi phiên.
  Request ghi phải cùng origin (`index.ts`).

## Quy ước

- Thời gian lưu giờ VN `YYYY-MM-DD HH:MM:SS`; ngày `YYYY-MM-DD`; tháng `YYYYMM`.
- Danh sách tham số truyền vào SQL bằng 1 bind JSON (`json_each`) — D1 giới hạn 100 tham số/câu.
- Comment code tiếng Việt không dấu (như linh-kien-app); giao diện tiếng Việt có dấu.
