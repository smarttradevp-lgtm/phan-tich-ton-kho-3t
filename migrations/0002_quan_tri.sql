-- Migration 0002: import ton kho tu file Excel (thay the tam thoi khi chua co API linh-kien-app), nhat ky thao tac.

-- nguon: 'linhkien' = dong bo API, 'import' = Excel MISA "Tong hop ton kho" do nhan su tai len.
ALTER TABLE ton_kho_phien ADD COLUMN nguon TEXT NOT NULL DEFAULT 'linhkien';
ALTER TABLE ton_kho_phien ADD COLUMN ten_file TEXT;
ALTER TABLE ton_kho_phien ADD COLUMN nguoi TEXT;

-- Nhat ky thao tac quan tri / cai dat (import da co import_log rieng).
CREATE TABLE nhat_ky (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    luc         TEXT NOT NULL,
    nguoi       TEXT,
    hanh_dong   TEXT NOT NULL,
    chi_tiet    TEXT
);
CREATE INDEX idx_nhat_ky_luc ON nhat_ky(luc);
