-- Migration 0001: schema ban dau "Phan tich ton kho 3T". Logic tinh: docs/DAC_TA_LOGIC.md.
-- Quy uoc: ngay = 'YYYY-MM-DD', thang = 'YYYYMM', thoi diem = gio VN 'YYYY-MM-DD HH:MM:SS'.

-- ---------------------------------------------------------------- Nguoi dung
-- vai_tro: 'admin' (moi quyen + duyet tai khoan) | 'nhap_lieu' (import + cai dat) | 'xem' (chi xem bao cao).
CREATE TABLE users (
    email           TEXT PRIMARY KEY,
    ten             TEXT,
    vai_tro         TEXT NOT NULL DEFAULT 'xem' CHECK (vai_tro IN ('admin', 'nhap_lieu', 'xem')),
    trang_thai      TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'khoa')),
    phien_ban_phien INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

-- Cau hinh dang key -> JSON: 'tham_so' (lib/tinhToan/thamSo.ts), 'dong_bo_*' (trang thai dong bo).
CREATE TABLE app_settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    nguoi_cap_nhat  TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

-- ---------------------------------------------------------------- Danh muc dong bo tu linh-kien-app
-- Chi ghi boi cron dong bo (lib/dongBoLinhKien.ts). Khai bao rieng cua app nam o lk_khai_bao.
CREATE TABLE linh_kien (
    ma              TEXT PRIMARY KEY,
    ten             TEXT,
    nhom_lk         TEXT,              -- karofi | b2b
    phan_loai_vat_ly TEXT,             -- linh_kien.don_vi ben linh-kien-app (Dinh tu, May...) - KHAC phan loai ton kho
    gia_du_phong    REAL,
    bat_tat         INTEGER NOT NULL DEFAULT 1,
    dong_bo_luc     TEXT NOT NULL
);

-- Kho: kho cong ty (linh-kien-app kho_cong_ty) + kho KTV (ma MISA cua KTV) + kho khac gap trong file import.
-- loai: 'cong_ty' / 'khac' = kho rieng trong bao cao; 'ktv' = gop thanh "Kho KTV chung" + bao cao thu hoi; 'bo_qua' = loai
-- khoi moi bao cao. ten_khac = JSON mang ten cu / ten tren
-- file MISA de khop file xuat thang tinh (chi co ten kho, khong co ma).
CREATE TABLE kho (
    ma              TEXT PRIMARY KEY,
    ten             TEXT NOT NULL,
    loai            TEXT NOT NULL DEFAULT 'khac' CHECK (loai IN ('cong_ty', 'ktv', 'khac', 'bo_qua')),
    ten_khac        TEXT NOT NULL DEFAULT '[]',
    nguon           TEXT NOT NULL DEFAULT 'tu_khai_bao' CHECK (nguon IN ('linhkien', 'tu_khai_bao', 'import')),
    -- Thong tin KTV (dong bo tu danh ba linh-kien-app; *_tay = nhan su sua tay, THANG gia tri dong bo)
    ma_ktv          TEXT,
    lam_viec        INTEGER,           -- 1 dang lam, 0 nghi/khoa, NULL chua biet
    phong_ban       TEXT,
    khu_vuc         TEXT,
    lam_viec_tay    INTEGER,
    phong_ban_tay   TEXT,
    khu_vuc_tay     TEXT,
    ngay_cap_nhat   TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

-- ---------------------------------------------------------------- Khai bao cua app (Settings)
-- Thay Sheet '3. Khai báo linh kiện'. Moi cot NULL = chua khai bao -> mac dinh o tham_so.
CREATE TABLE lk_khai_bao (
    ma                  TEXT PRIMARY KEY,
    ten                 TEXT,          -- chi dung khi ma khong co trong linh_kien
    phan_loai           TEXT,          -- Linh kien thuong dung / It dung... (tham chieu phan_loai_lk.ten)
    nganh               TEXT,          -- Loc nuoc / Dieu hoa / ...
    noi_san_xuat        TEXT,          -- SX / NK
    he_so_du_tru        REAL,
    leadtime            REAL,
    doi_tac             TEXT,
    nhom_tuong_duong    TEXT,
    gia_nhap            REAL,
    gia_nhap_nguon      TEXT,          -- 'import' | 'tay' | 'drive'
    gia_nhap_luc        TEXT,
    nguoi_cap_nhat      TEXT,
    ngay_cap_nhat       TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

-- Thay Sheet '4.2. Phân loại thu hồi'.
CREATE TABLE phan_loai_lk (
    ten             TEXT PRIMARY KEY,
    he_so_thu_hoi   REAL NOT NULL DEFAULT 0,
    stt             INTEGER NOT NULL DEFAULT 0
);

-- Thay Sheet '0.5.2. Thu hồi settings': phan loai x nhom -> danh gia.
CREATE TABLE ma_tran_thu_hoi (
    phan_loai       TEXT NOT NULL,
    nhom            TEXT NOT NULL CHECK (nhom IN ('Nhóm 1', 'Nhóm 2', 'Nhóm 3', 'Nhóm 4')),
    danh_gia        TEXT NOT NULL,
    PRIMARY KEY (phan_loai, nhom)
);

-- ---------------------------------------------------------------- So chi tiet vat tu (import hang ngay)
-- Moi lan import 1 file 30 ngay: ghi vao so_chi_tiet_tam theo lo, lo cuoi XOA so_chi_tiet trong [tu_ngay, den_ngay] cua
-- cac kho co trong file roi chep tu bang tam - trong 1 batch (routes/importDuLieu.ts). Import lai khong cong trung.
CREATE TABLE so_chi_tiet (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_kho          TEXT NOT NULL,
    ten_kho         TEXT,
    ma_hang         TEXT NOT NULL,
    ten_hang        TEXT,
    ngay_hach_toan  TEXT NOT NULL,
    ngay_chung_tu   TEXT,
    so_chung_tu     TEXT,
    dvt             TEXT,
    dien_giai       TEXT,
    sl_nhap         REAL NOT NULL DEFAULT 0,
    sl_xuat         REAL NOT NULL DEFAULT 0,
    tk_doi_ung      TEXT,
    import_id       INTEGER
);
CREATE INDEX idx_sct_ngay ON so_chi_tiet(ngay_hach_toan);
CREATE INDEX idx_sct_kho_ngay ON so_chi_tiet(ma_kho, ngay_hach_toan);
CREATE INDEX idx_sct_hang ON so_chi_tiet(ma_hang);

CREATE TABLE so_chi_tiet_tam (
    lo              TEXT NOT NULL,
    ma_kho          TEXT NOT NULL,
    ten_kho         TEXT,
    ma_hang         TEXT NOT NULL,
    ten_hang        TEXT,
    ngay_hach_toan  TEXT NOT NULL,
    ngay_chung_tu   TEXT,
    so_chung_tu     TEXT,
    dvt             TEXT,
    dien_giai       TEXT,
    sl_nhap         REAL NOT NULL DEFAULT 0,
    sl_xuat         REAL NOT NULL DEFAULT 0,
    tk_doi_ung      TEXT
);
CREATE INDEX idx_sct_tam_lo ON so_chi_tiet_tam(lo);

-- ---------------------------------------------------------------- Xuat theo thang (tinh)
-- nguon 'import' = file tinh thang cu (Sheet '1.1. Data kho Cũ'); 'chot' = he thong tu chot tu so_chi_tiet khi thang
-- da qua tham_so.so_thang_chot_tinh thang. Thang CHUA co o day -> tinh dong tu so_chi_tiet.
CREATE TABLE xuat_thang (
    thang           TEXT NOT NULL,
    ma_kho          TEXT NOT NULL,
    ma_hang         TEXT NOT NULL,
    ten_hang        TEXT,
    sl_xuat         REAL NOT NULL DEFAULT 0,
    nguon           TEXT NOT NULL CHECK (nguon IN ('import', 'chot')),
    ngay_ghi        TEXT NOT NULL,
    PRIMARY KEY (thang, ma_kho, ma_hang)
);
CREATE INDEX idx_xt_hang ON xuat_thang(ma_hang);

CREATE TABLE xuat_thang_tam (
    lo              TEXT NOT NULL,
    thang           TEXT NOT NULL,
    ma_kho          TEXT NOT NULL,
    ma_hang         TEXT NOT NULL,
    ten_hang        TEXT,
    sl_xuat         REAL NOT NULL DEFAULT 0
);
CREATE INDEX idx_xt_tam_lo ON xuat_thang_tam(lo);

-- ---------------------------------------------------------------- Ton kho (anh chup tu linh-kien-app)
-- linh-kien-app GHI DE ton kho moi lan Ke toan import file MISA, khong giu lich su -> app luu 1 phien moi khi phien_ban
-- ben do doi. ky_tu_ngay / ky_den_ngay = ky cua cot xuat_kho trong file (dung tinh ton chuan bao cao thu hoi).
CREATE TABLE ton_kho_phien (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phien_ban       TEXT NOT NULL UNIQUE,
    ky_tu_ngay      TEXT,
    ky_den_ngay     TEXT,
    so_dong_kho     INTEGER NOT NULL DEFAULT 0,
    so_dong_ktv     INTEGER NOT NULL DEFAULT 0,
    trang_thai      TEXT NOT NULL DEFAULT 'dang_keo' CHECK (trang_thai IN ('dang_keo', 'xong', 'loi')),
    bat_dau_luc     TEXT NOT NULL,
    xong_luc        TEXT
);

CREATE TABLE ton_kho (
    phien_id        INTEGER NOT NULL REFERENCES ton_kho_phien(id),
    nguon           TEXT NOT NULL CHECK (nguon IN ('kho', 'ktv')),
    ma_kho          TEXT NOT NULL,
    ma_ktv          TEXT,
    ma_hang         TEXT NOT NULL,
    ten_hang        TEXT,
    dau_ky          REAL,
    nhap_kho        REAL,
    xuat_kho        REAL,
    cuoi_ky         REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (phien_id, nguon, ma_kho, ma_hang)
);
CREATE INDEX idx_tk_hang ON ton_kho(phien_id, ma_hang);

-- ---------------------------------------------------------------- Nguon ngoai (cho API ben DVBH / EO Mua hang)
-- Ghi de toan bo moi lan dong bo. Chua co API -> bang rong, bao cao bo qua cot tuong ung.
CREATE TABLE dvbh_thieu_lk (
    ma_hang         TEXT PRIMARY KEY,
    so_ca           INTEGER NOT NULL DEFAULT 0,
    cap_nhat_luc    TEXT NOT NULL
);

CREATE TABLE hang_dang_ve (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_hang         TEXT NOT NULL,
    ma_kho          TEXT,
    so_luong        REAL NOT NULL DEFAULT 0,
    ngay_du_kien    TEXT,
    ma_eo           TEXT,
    cap_nhat_luc    TEXT NOT NULL
);
CREATE INDEX idx_hdv_hang ON hang_dang_ve(ma_hang);

-- ---------------------------------------------------------------- Nhat ky import / dong bo
CREATE TABLE import_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    loai            TEXT NOT NULL,     -- so_chi_tiet | xuat_thang | gia_nhap | khai_bao_lk | kho | dong_bo_ton_kho ...
    ten_file        TEXT,
    nguoi           TEXT,
    luc             TEXT NOT NULL,
    so_dong         INTEGER NOT NULL DEFAULT 0,
    tu_ngay         TEXT,
    den_ngay        TEXT,
    trang_thai      TEXT NOT NULL DEFAULT 'xong',
    ghi_chu         TEXT
);

-- ---------------------------------------------------------------- Du lieu mac dinh
-- Du lieu mac dinh lay tu Sheet '4.2. Phân loại thu hồi' + '0.5.2. Thu hồi settings' (29/10/2026). Ten trung -> lay dong dau (nhu VLOOKUP).
INSERT INTO phan_loai_lk (ten, he_so_thu_hoi, stt) VALUES
  ('Chưa cài đặt', 0, 0),
  ('Linh kiện thường dùng', 1, 1),
  ('Linh kiện ít dùng nhưng cần tồn kho lâu', 4, 2),
  ('Linh kiện ít dùng nhưng không quan trọng', 2, 3),
  ('Linh kiện cắt mã', 0, 4),
  ('Linh kiện thường dùng có thể mua ngoài', 1, 5),
  ('Máy', 0, 6),
  ('Linh kiện đối tác', 0, 7),
  ('Linh kiện ít dùng', 2, 8),
  ('Thuộc diện cắt mã', 0, 9),
  ('Có thể mua ngoài', 1, 10),
  ('Thuộc diện ít dùng', 2, 11),
  ('LK thường dùng nhưng có mã tương đương', 1, 12),
  ('Linh kiện ít dùng chỉ đặt khi phát sinh nhu cầu', 2, 13),
  ('Quà tặng team PTDV', 0, 14),
  ('Không có tồn', 0, 15);

INSERT INTO ma_tran_thu_hoi (phan_loai, nhom, danh_gia) VALUES
  ('Linh kiện thường dùng', 'Nhóm 1', 'Thu hồi toàn bộ'),
  ('Linh kiện thường dùng', 'Nhóm 2', 'Theo dõi tiếp'),
  ('Linh kiện thường dùng', 'Nhóm 3', 'Theo dõi tiếp'),
  ('Linh kiện thường dùng', 'Nhóm 4', 'Theo dõi tiếp'),
  ('Linh kiện ít dùng nhưng cần tồn kho lâu', 'Nhóm 1', 'Thu hồi toàn bộ'),
  ('Linh kiện ít dùng nhưng cần tồn kho lâu', 'Nhóm 2', 'Theo dõi tiếp'),
  ('Linh kiện ít dùng nhưng cần tồn kho lâu', 'Nhóm 3', 'Theo dõi tiếp'),
  ('Linh kiện ít dùng nhưng cần tồn kho lâu', 'Nhóm 4', 'Theo dõi tiếp'),
  ('Linh kiện ít dùng nhưng không quan trọng', 'Nhóm 1', 'Thu hồi toàn bộ'),
  ('Linh kiện ít dùng nhưng không quan trọng', 'Nhóm 2', 'Theo dõi tiếp'),
  ('Linh kiện ít dùng nhưng không quan trọng', 'Nhóm 3', 'Theo dõi tiếp'),
  ('Linh kiện ít dùng nhưng không quan trọng', 'Nhóm 4', 'Theo dõi tiếp'),
  ('Thuộc diện cắt mã', 'Nhóm 1', 'Thu hồi toàn bộ'),
  ('Thuộc diện cắt mã', 'Nhóm 2', 'Thu hồi toàn bộ'),
  ('Thuộc diện cắt mã', 'Nhóm 3', 'Thu hồi toàn bộ'),
  ('Thuộc diện cắt mã', 'Nhóm 4', 'Thu hồi toàn bộ'),
  ('Không có tồn', 'Nhóm 1', 'Thu hồi toàn bộ'),
  ('Không có tồn', 'Nhóm 2', 'Không xử lý'),
  ('Không có tồn', 'Nhóm 3', 'Không xử lý'),
  ('Không có tồn', 'Nhóm 4', 'Không xử lý'),
  ('Linh kiện thường dùng có thể mua ngoài', 'Nhóm 1', 'Thu hồi toàn bộ'),
  ('Linh kiện thường dùng có thể mua ngoài', 'Nhóm 2', 'Thu hồi toàn bộ'),
  ('Linh kiện thường dùng có thể mua ngoài', 'Nhóm 3', 'Thu hồi toàn bộ'),
  ('Linh kiện thường dùng có thể mua ngoài', 'Nhóm 4', 'Thu hồi toàn bộ'),
  ('Máy', 'Nhóm 1', 'Thu hồi toàn bộ'),
  ('Máy', 'Nhóm 2', 'Xem xét lý do tồn để thu hồi đúng hạn'),
  ('Máy', 'Nhóm 3', 'Xem xét lý do tồn để thu hồi đúng hạn'),
  ('Máy', 'Nhóm 4', 'Xem xét lý do tồn để thu hồi đúng hạn'),
  ('Linh kiện đối tác', 'Nhóm 1', 'Thu hồi toàn bộ'),
  ('Linh kiện đối tác', 'Nhóm 2', 'Xem xét lý do tồn để thu hồi đúng hạn'),
  ('Linh kiện đối tác', 'Nhóm 3', 'Xem xét lý do tồn để thu hồi đúng hạn'),
  ('Linh kiện đối tác', 'Nhóm 4', 'Xem xét lý do tồn để thu hồi đúng hạn'),
  ('Có thể mua ngoài', 'Nhóm 1', 'Không xử lý'),
  ('Có thể mua ngoài', 'Nhóm 2', 'Không xử lý'),
  ('Có thể mua ngoài', 'Nhóm 3', 'Không xử lý'),
  ('Có thể mua ngoài', 'Nhóm 4', 'Không xử lý'),
  ('Chưa cài đặt', 'Nhóm 1', 'Không xử lý'),
  ('Chưa cài đặt', 'Nhóm 2', 'Không xử lý'),
  ('Chưa cài đặt', 'Nhóm 3', 'Không xử lý'),
  ('Chưa cài đặt', 'Nhóm 4', 'Không xử lý'),
  ('LK thường dùng nhưng có mã tương đương', 'Nhóm 1', 'Thu hồi toàn bộ'),
  ('LK thường dùng nhưng có mã tương đương', 'Nhóm 2', 'Theo dõi tiếp'),
  ('LK thường dùng nhưng có mã tương đương', 'Nhóm 3', 'Theo dõi tiếp'),
  ('LK thường dùng nhưng có mã tương đương', 'Nhóm 4', 'Theo dõi tiếp'),
  ('Linh kiện ít dùng chỉ đặt khi phát sinh nhu cầu', 'Nhóm 1', 'Thu hồi toàn bộ'),
  ('Linh kiện ít dùng chỉ đặt khi phát sinh nhu cầu', 'Nhóm 2', 'Theo dõi tiếp'),
  ('Linh kiện ít dùng chỉ đặt khi phát sinh nhu cầu', 'Nhóm 3', 'Theo dõi tiếp'),
  ('Linh kiện ít dùng chỉ đặt khi phát sinh nhu cầu', 'Nhóm 4', 'Theo dõi tiếp');
