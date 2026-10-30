# Hướng dẫn triển khai (dành cho Claude Code chạy trên máy người dùng)

Tài liệu này để giao cho **Claude Code trên máy của chủ dự án**: kéo repo về, deploy, rồi làm tiếp các bước còn thiếu
của app "Phân tích tồn kho 3T" và phần "Kho dữ liệu MISA" (kế hoạch: `docs/KE_HOACH_KHO_MISA.md`, API: `docs/API_DOI_TAC_MISA.md`).

> **Claude đọc kỹ mục 0 trước khi chạy bất kỳ lệnh nào.**

---

## 0. Quy tắc bắt buộc

1. **Hỏi người dùng trước mỗi thao tác không hoàn tác được / chạm hệ thống thật**: `wrangler deploy`, `npm run deploy*`,
   `db:migrate:remote` / `db:migrate:smarttrade`, `wrangler d1 create`, `wrangler secret put`, merge vào nhánh chính, push.
   Nói rõ lệnh nào, vào Worker/D1 nào, rồi chờ "OK".
2. **Không bao giờ in / dán / commit khoá bí mật** (khoá API, client secret, SESSION_SECRET, HUB_SYNC_KEY). Khi cần đặt secret:
   chạy `npx wrangler secret put <TÊN>` để **người dùng tự gõ / dán** vào terminal. Không ghi khoá vào file trong repo, không gửi
   qua chat. Sinh chuỗi ngẫu nhiên bằng lệnh ở mục 1 rồi để người dùng copy trực tiếp.
3. `DEV_LOGIN` chỉ được nằm trong `.dev.vars` (máy local). **Không bao giờ** đặt ở `wrangler.jsonc` hay secrets thật.
4. 3 repo, 3 quy ước deploy khác nhau — **đừng lẫn**:

| Repo | Nhánh làm việc | Worker / D1 thật | Lệnh deploy thật |
|---|---|---|---|
| `smarttradevp-lgtm/phan-tich-ton-kho-3t` (app này, gọi tắt **Hub**) | `claude/khoi-tao-du-an` (nhánh mặc định, duy nhất) | `phantichtonkho` / `phan-tich-ton-kho-db` (CHƯA tạo) | `npm run deploy`, `npm run db:migrate:remote` |
| `smarttradevp-lgtm/linh-kien-app` (gọi tắt **LK**) | `master` + nhánh mới `claude/nguon-ton-kho-hub` | `linhkien` (đang chạy thật) | `npm run deploy`, `npm run db:migrate:remote` |
| `smarttradevp-lgtm/dvbh-suite` (**DVBH**) | không cần sửa code | `dvbh` (smarttrade) | **chỉ** `npm run deploy:smarttrade` — KHÔNG dùng `npm run deploy` |

5. LK: **tăng `APP_VERSION`** (`frontend/src/version.ts`, +0.001, sửa tay chuỗi) trước mỗi lần deploy.
6. Sau mỗi bước lớn: chạy `npm run typecheck` (+ `npm test` ở Hub) trước khi deploy.
7. Repo Hub đang **Public** → khuyên người dùng chuyển **Private** (GitHub › Settings › Danger Zone › Change visibility) trước
   khi đưa dữ liệu / tài liệu nội bộ lên thêm.

---

## 1. Chuẩn bị máy

```bash
node -v          # cần >= 20
npx wrangler --version
gh auth status   # đăng nhập GitHub có quyền 3 repo
```

```bash
npx wrangler login     # đăng nhập ĐÚNG tài khoản Cloudflare đang chạy Worker linhkien / dvbh
npx wrangler whoami    # kiểm tra account — 3 Worker phải cùng 1 account (Service Binding chỉ chạy trong cùng account)
```

Kéo repo (đặt cạnh nhau trong 1 thư mục):
```bash
gh repo clone smarttradevp-lgtm/phan-tich-ton-kho-3t
gh repo clone smarttradevp-lgtm/linh-kien-app
```
(DVBH chỉ cần khi tạo khoá API — làm trên giao diện web, không cần clone.)

Sinh chuỗi ngẫu nhiên (dùng cho `SESSION_SECRET`, `HUB_SYNC_KEY`) — người dùng copy kết quả, không lưu vào file:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## 2. linh-kien-app — đưa nhánh "nguồn tồn kho từ Hub" lên

Trạng thái: `master` đã có v1.421 (API cho Hub: `/v1/ton-kho` thêm `dau_ky/nhap_kho/xuat_kho`, `/v1/linh-kien/danh-sach`,
`/v1/danh-ba-kho`) — **đã deploy hay chưa thì kiểm tra**. Nhánh `claude/nguon-ton-kho-hub` (v1.422, migration `0104`) thêm: công tắc
nguồn tồn kho `file | hub_thu | hub`, bảng bóng, route `/api/hub-misa`, cron kéo tồn, khối "Nguồn tồn kho" ở màn Công nợ.

```bash
cd linh-kien-app
git fetch origin
git checkout claude/nguon-ton-kho-hub
git merge origin/master            # nếu có xung đột: giải quyết, ưu tiên giữ code của master + phần hub
ls migrations | tail -5
```

**Kiểm tra số migration**: nếu master đã có file `0104_*.sql` KHÁC `0104_ton_kho_tu_hub.sql` → đổi tên file của nhánh thành số
tiếp theo (vd `0105_ton_kho_tu_hub.sql`) — chỉ đổi được vì file này **chưa áp lên D1 thật**. Kiểm tra:
```bash
npx wrangler d1 migrations list <TÊN_D1_LK> --remote     # tên D1 xem trong wrangler.jsonc (d1_databases[0].database_name)
```

```bash
npm install
npm run typecheck --workspace backend
npm run typecheck --workspace frontend
npm run build
```

Kiểm tra nhanh local (tuỳ chọn): `npm run db:migrate:local` rồi `npm run dev:worker`.

**Giữ `HUB_SERVICE` còn comment** trong `wrangler.jsonc` ở lần deploy này (Worker `phantichtonkho` chưa tồn tại → deploy sẽ lỗi).

→ **Hỏi người dùng**, rồi:
```bash
git push -u origin claude/nguon-ton-kho-hub
gh pr create --base master --title "v1.422: nguon ton kho tu app Phan tich ton kho 3T" --body "Migration 0104 (bang bong + user he thong), /api/hub-misa, cong tac nguon ton kho file/hub_thu/hub."
# người dùng duyệt + merge PR, rồi:
git checkout master && git pull
npm run db:migrate:remote
npm run deploy
```
Công tắc mặc định là `file` → deploy này **không đổi hành vi** đang chạy.

### 2b. Tạo khoá API LK cho Hub
Người dùng (Admin) vào LK › **Cài đặt › API đối tác** → tạo khoá tên "Phân tích tồn kho 3T". Khoá chỉ hiện 1 lần — giữ để đặt
secret `LINHKIEN_API_KEY` ở bước 3.

### 2c. (Tuỳ chọn) Khoá API DVBH cho Hub
Admin DVBH › **Settings › API đối tác** → cấp key "Phân tích tồn kho 3T" (dùng cho thẻ "Ca DVBH đang báo thiếu" trong Hồ sơ linh kiện,
API `GET /api/partner/thieu-linh-kien`). Không có thì thẻ đó hiện "chưa kết nối". DVBH không phải sửa code / deploy.

---

## 3. Hub (app này) — triển khai lần đầu

```bash
cd ../phan-tich-ton-kho-3t
git checkout claude/khoi-tao-du-an && git pull
npm install
npm test && npm run typecheck && npm run build
```

### 3.1 D1
→ Hỏi người dùng, rồi:
```bash
npx wrangler d1 create phan-tich-ton-kho-db
```
Điền `database_id` in ra vào `wrangler.jsonc` (thay `REPLACE_WITH_D1_DATABASE_ID`), rồi:
```bash
npm run db:migrate:remote
```

### 3.2 Google OAuth Client
Người dùng làm ở Google Cloud Console (APIs & Services › Credentials › Create OAuth client ID › Web application):
- Authorized redirect URI: `https://phantichtonkho.dichvu3t.workers.dev/api/auth/callback`
- Authorized JavaScript origin: `https://phantichtonkho.dichvu3t.workers.dev`
- OAuth consent screen: nếu đang "Testing" thì thêm email người dùng vào Test users (hoặc Publish).

Nếu subdomain workers.dev của account KHÔNG phải `dichvu3t` → sửa `GOOGLE_REDIRECT_URI`, `FRONTEND_URL` trong `wrangler.jsonc`
(và `LINHKIEN_BASE_URL`/`DVBH_BASE_URL` nếu khác).

### 3.3 Service Binding
Bỏ comment khối `services` trong `wrangler.jsonc` (`LINHKIEN_SERVICE` → `linhkien`, `DVBH_SERVICE` → `dvbh`). Kiểm tra tên Worker
thật: `npx wrangler deployments list --name linhkien` (hoặc xem dashboard). Không có quyền DVBH thì để comment dòng `DVBH_SERVICE`.

### 3.4 Secrets
→ Hỏi người dùng; mỗi lệnh người dùng tự dán giá trị:
```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET      # chuỗi ngẫu nhiên mục 1
npx wrangler secret put LINHKIEN_API_KEY    # khoá bước 2b
npx wrangler secret put DVBH_API_KEY        # khoá bước 2c (bỏ qua nếu chưa có)
npx wrangler secret put HUB_SYNC_KEY        # chuỗi ngẫu nhiên MỚI — ghi nhớ tạm để đặt GIỐNG HỆT bên LK ở bước 4
```
(Lần đầu `secret put` khi Worker chưa tồn tại, wrangler sẽ hỏi tạo Worker — đồng ý.)

### 3.5 Deploy
```bash
npm run deploy
```
Mở `https://phantichtonkho.dichvu3t.workers.dev` → đăng nhập bằng `smarttrade.vp@gmail.com` (`BOOTSTRAP_ADMIN_EMAIL`, tự thành admin).
Quản trị › Người dùng: duyệt tài khoản Kế toán với vai trò **Nhập liệu**, người xem với vai trò **Xem**.

Kiểm tra: `npx wrangler tail phantichtonkho` trong lúc mở vài trang — không có lỗi 500.

---

## 4. Nối LK ↔ Hub

1. Hub › **Quản trị › Kho dữ liệu MISA › Tạo khoá**: tên "linh-kien-app", quyền **Tồn kho**. Khoá hiện 1 lần.
2. Bên LK (→ hỏi người dùng):
   ```bash
   cd ../linh-kien-app
   npx wrangler secret put HUB_API_KEY      # khoá vừa tạo
   npx wrangler secret put HUB_SYNC_KEY     # GIỐNG HỆT giá trị đã đặt ở Hub bước 3.4
   ```
3. LK `wrangler.jsonc`: bỏ comment dòng `{ "binding": "HUB_SERVICE", "service": "phantichtonkho", "remote": true }`.
   Tăng `APP_VERSION` lên `"1.423"` (hoặc +0.001 so với bản đang chạy), typecheck, commit, PR/merge, `npm run deploy`.
4. Kiểm tra API Hub bằng khoá (khoá để trong biến môi trường, không in ra):
   ```bash
   read -s HUBKEY   # dán khoá, Enter
   curl -s -H "X-API-Key: $HUBKEY" https://phantichtonkho.dichvu3t.workers.dev/api/doi-tac/v1/misa/ton-kho/meta
   unset HUBKEY
   ```
   Chưa nhập file tồn ở Hub → `{"phien_ban":null}` là đúng.
5. LK › màn **Công nợ** › khối "Nguồn tồn kho": hiện cấu hình Hub = có; bấm "Kéo ngay" không báo lỗi khoá.

---

## 5. Nạp dữ liệu ban đầu vào Hub

Đăng nhập Hub (Admin hoặc Kế toán):
1. **Nhập & đồng bộ › Đồng bộ ngay** (danh mục LK, danh bạ kho / KTV, tồn kho từ LK).
2. **Cài đặt › Kho**: kiểm tra loại từng kho (kho công ty / KTV / khác / bỏ qua) — sai loại là sai báo cáo.
3. Import lần đầu (file mẫu có ở màn Nhập dữ liệu):
   - Xuất tháng tĩnh (sheet "1.1. Data kho Cũ" của Google Sheet cũ)
   - Khai báo LK (sheet "3. Khai báo linh kiện")
   - Thông tin kho KTV (sheet "4.3. Cài đặt kho")
   - Giá nhập (file trên Google Drive)
   - Sổ chi tiết vật tư MISA ~30 ngày gần nhất
   - Tổng hợp tồn kho MISA (file tồn mới nhất, chọn đúng kỳ từ/đến ngày)
4. Mở 4 báo cáo + Tổng quan, so với Google Sheet theo `docs/DAC_TA_LOGIC.md` mục 9. Ghi lại chênh lệch cho người dùng.

---

## 6. Giai đoạn 1 — chạy song song (~10 ngày làm việc)

- LK › Công nợ › Nguồn tồn kho: Admin chọn **"Thử (bảng bóng)"** (`hub_thu`). Nghiệp vụ LK vẫn dùng file như cũ.
- Kế toán nhập file tồn ở **cả 2 app** mỗi ngày.
- Mỗi ngày kiểm tra:
  - Hub › Quản trị › Dữ liệu hệ thống › **Đối chiếu 2 phiên tồn kho** (phiên File Excel vs phiên kéo từ LK) → phải "khớp".
  - LK › Công nợ › khối Nguồn tồn kho: đối chiếu bảng bóng ↔ bảng thật = khớp.
  - Hub › Nhập dữ liệu: "linh-kien-app đã kéo phiên mới" sau mỗi lần nhập.
- Lệch → tìm nguyên nhân (thường: kho chưa khớp mã MISA KTV, file nhập khác kỳ) trước khi sang giai đoạn 2.

## 7. Giai đoạn 2 — chuyển nguồn (cần người dùng chốt)

1. LK: Admin chọn nguồn **"App Phân tích tồn kho"** (`hub`). Từ đây import file tồn ở LK chỉ còn Admin (dự phòng), Kế toán bị chặn.
2. Hub › Quản trị › Kho dữ liệu MISA: bật **"App này là nguồn tồn kho"** (Hub thôi kéo tồn từ LK).
3. Báo Kế toán: từ nay chỉ nhập file ở Hub.
4. Theo dõi 2–3 ngày: mốc nhập tồn ở LK = `phien_ban` của Hub; đơn tự duyệt / Thiếu hàng "Kho đã có đủ hàng" chạy bình thường.

**Quay lui**: LK chọn lại nguồn `file`, Hub tắt công tắc → Kế toán nhập file ở LK như trước. Không mất dữ liệu.

---

## 8. Giai đoạn 3 — EO Mua hàng (repo `ETX87/eo-mua-hang`, cần quyền ghi của chủ repo đó)

Mục tiêu: EO thôi bắt người dùng import "Sổ chi tiết vật tư", kéo từ Hub.
1. Hub › Kho dữ liệu MISA › Tạo khoá "EO Mua hàng", quyền **Sổ chi tiết**. Đặt vào secret của Worker EO.
2. Service Binding EO → `phantichtonkho` (cùng account).
3. Code bên EO: cron / nút đồng bộ — đọc `GET /v1/misa/so-chi-tiet/meta`; khi `lan_import_cuoi.id` đổi → kéo
   `GET /v1/misa/so-chi-tiet?tu=<tu_ngay>&den=<den_ngay>&chi_nhap=1` (phân trang `after_id`) → map vào `amis_receipt`:
   `ma_kho→warehouse_code`, `ten_kho→warehouse_name`, `ma_hang→part_code`, `ten_hang→part_name`, `ngay_hach_toan→posting_date`,
   `ngay_chung_tu→doc_date`, `so_chung_tu→doc_no`, `dvt→uom`, `dien_giai→description`, `sl_nhap→qty_in`, `sl_xuat→qty_out`,
   `sl_ton→qty_balance`, `tk_kho`, `tk_doi_ung`, `ma_phe_duyet→approval_code_raw`. Giữ khoá trùng
   `SỐ_CT|Tên kho|MÃ_HÀNG|SL nhập|Ngày CT|MÃ_PHÊ_DUYỆT` để không nhân dòng. Giữ import tay làm dự phòng.
4. Chạy song song 1 tuần (so số dòng `amis_receipt` theo ngày), rồi tắt import tay.

## 9. Việc còn mở khác (làm khi người dùng yêu cầu)

| Việc | Ghi chú |
|---|---|
| Nguồn "Ca DVBH báo thiếu" cho báo cáo Leadtime (`dvbh_thieu_lk`) | Bảng đã có; viết đồng bộ từ `GET /api/partner/thieu-linh-kien` của DVBH (khoá bước 2c) |
| Nguồn "Hàng đang về" (`hang_dang_ve`) | Chờ EO có API hàng đang về theo mã LK |
| Kho KTV khớp theo Mã MISA | Kiểm tra danh sách "chưa khớp" ở Cài đặt › Kho sau lần đồng bộ đầu |
| Dung lượng D1 | Quản trị › Dữ liệu hệ thống: xoá phiên tồn cũ, dọn sổ chi tiết tháng đã chốt tĩnh |
| Repo Hub Public → Private | Mục 0.7 |

---

## 10. Câu lệnh giao cho Claude trên máy

Dán nguyên văn vào Claude Code (mở trong thư mục trống):

```
Đọc và làm theo docs/HUONG_DAN_TRIEN_KHAI.md trong repo smarttradevp-lgtm/phan-tich-ton-kho-3t
(nhánh claude/khoi-tao-du-an). Clone repo đó và smarttradevp-lgtm/linh-kien-app về thư mục hiện tại,
đọc CLAUDE.md của cả 2 repo. Làm lần lượt mục 1 → 5. Tuân thủ mục 0: hỏi tôi trước mỗi lệnh deploy /
migrate remote / tạo D1 / đặt secret / merge / push; không bao giờ in hay ghi khoá bí mật vào file —
khi cần secret thì chạy `wrangler secret put` để tôi tự dán. Dừng lại báo cáo sau mỗi mục.
Mục 6–8 chỉ làm khi tôi bảo.
```
