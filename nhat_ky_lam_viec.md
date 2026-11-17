# Nhật ký làm việc — App Phân tích tồn kho 3T

> Mỗi đợt làm việc 1 mục, **mới nhất ở trên**: ngày, phiên bản, yêu cầu, đã làm gì, kiểm thử gì, việc còn dở. Chỉ ghi thêm, không xoá mục cũ.
> Không ghi tài khoản, mật khẩu, khoá hay mô tả lỗ hổng bảo mật vào file này (repo có thể công khai).

## 17/11/2026 — Tạo bộ tài liệu tổng hợp

- Yêu cầu: "dựa theo nguyên tắc tạo 3 file bắt buộc, rà soát toàn bộ các repo và tạo 3 file rồi đẩy lên repo etx87".
- Tạo `nhat_ky_lam_viec.md` (file này), `TONG_HOP_LOGIC.md`, `SRS_tong_hop.md`.
- Phần "Lịch sử dựng lại từ Git" bên dưới sinh tự động từ commit (bỏ commit gộp nhánh + commit tự động Workflow Mây). Từ nay ghi tay mục mới ở trên.

## Lịch sử dựng lại từ Git (15 commit, 2026-10-29 → 2026-11-17)

### 2026-10-30
- Tai lieu: huong dan trien khai chi tiet cho Claude tren may (deploy Hub + linh-kien-app, noi 2 ben, chay song song, chuyen nguon, EO) (`bdd1d08`)
- Tai lieu: tien do kho du lieu MISA (giai doan 0 xong, ket qua chay thu 2 Worker), CLAUDE.md muc Kho du lieu MISA (`fcc044f`)
- Kho du lieu MISA (giai doan 0): API doi tac /api/doi-tac/v1/misa/* (ton kho theo phien ban, so chi tiet, xuat thang), khoa API, bao linh-kien-app khi co phien ton moi, cong tac nguon ton, doi chieu 2 phien, so chi tiet them TK kho / SL ton / Ma phe duyet (`e961621`)
- Ke hoach: app Phan tich ton kho 3T lam kho du lieu MISA goc, cac ben keo qua API (linh-kien-app, DVBH, EO) (`b70f469`)
- CLAUDE.md: sua mo ta so vung Ho so linh kien (`6588307`)
- Ho so linh kien: ma tuong duong, dien bien ton qua cac phien, nhap/xuat theo ngay, gia tri, lich su sua khai bao; ket noi linh-kien-app (anh, gia, thay the, combo, cong no KTV, don dat, ticket thieu hang, ton kha dung) + app DVBH (ca dang bao thieu) goi luc mo, hien 'chua ket noi' khi chua co khoa (`affefa7`)
- Ho so linh kien: popup ~95% man hinh theo bo cuc DVBH (the so lieu, nhan dinh nhanh, 4 vung: tieu hao, danh gia rui ro, nguon hang, chung tu & khai bao); backend tinh rieng 1 ma (chiMa), chuyen ma truoc/sau, link ?lk= (`c36acec`)
- Loc cot kieu Excel (nhieu gia tri / khoang so) cho moi bang, luu bo loc tren URL + localStorage, Xoa loc; Leadtime them Nhom tuong duong, Doi tac, SL du tru tieu chuan, ton du uoc tinh, loc Phan loai; Dap chieu them cot Nganh (`155b9ef`)

### 2026-10-29
- Giao dien mobile: bang chuyen dang the + chon sap xep, thanh dieu huong duoi, bo loc luoi 2 cot, modal dang bottom sheet, bieu do theo do rong that, tong hop leadtime dang the, sua tran ngang (`c7fa345`)
- Giao dien moi + tong quan bieu do, chi tiet LK, import ton kho Excel, xem truoc / file mau, sua hang loat, gop phan loai, quan tri du lieu, nhat ky, dev-login local (`27a8aab`)
- Gia nhap chua co: dung gia du phong, khong co = 0 (gan nhan nguon gia tren bao cao) (`e5eca97`)
- Khoi tao app Phan tich ton kho 3T: schema D1, bo tinh 4 bao cao (doi chieu Sheet), import, dong bo linh-kien-app, giao dien (`0474870`)
