-- Migration 0003: app la KHO DU LIEU MISA GOC (docs/KE_HOACH_KHO_MISA.md) - cac he thong khac keo qua API doi tac.

-- Ton kho: giu them ten kho + DVT nhu file (linh-kien-app luu 2 cot nay).
ALTER TABLE ton_kho ADD COLUMN ten_kho TEXT;
ALTER TABLE ton_kho ADD COLUMN dvt TEXT;

-- So chi tiet: them cot EO Mua hang can (khop phieu nhap voi PO theo "Mã phê duyệt").
ALTER TABLE so_chi_tiet ADD COLUMN tk_kho TEXT;
ALTER TABLE so_chi_tiet ADD COLUMN sl_ton REAL;
ALTER TABLE so_chi_tiet ADD COLUMN ma_phe_duyet TEXT;
ALTER TABLE so_chi_tiet_tam ADD COLUMN tk_kho TEXT;
ALTER TABLE so_chi_tiet_tam ADD COLUMN sl_ton REAL;
ALTER TABLE so_chi_tiet_tam ADD COLUMN ma_phe_duyet TEXT;
CREATE INDEX idx_sct_import ON so_chi_tiet(import_id);

-- Khoa API doi tac (X-API-Key): luu ban bam SHA-256, chi hien khoa 1 lan luc tao. quyen = JSON mang tap du lieu duoc doc.
-- phien_ton_da_keo = phien ban ton kho moi nhat ma ben nay da keo HET (de Ke toan thay "cac ben da nhan phien moi chua").
CREATE TABLE doi_tac_api_key (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    ten                 TEXT NOT NULL,
    khoa_bam            TEXT NOT NULL UNIQUE,
    tien_to             TEXT NOT NULL,
    quyen               TEXT NOT NULL DEFAULT '["ton_kho","so_chi_tiet","xuat_thang"]',
    bat_tat             INTEGER NOT NULL DEFAULT 1,
    tao_luc             TEXT NOT NULL,
    tao_boi             TEXT,
    dung_cuoi_luc       TEXT,
    phien_ton_da_keo    TEXT,
    phien_ton_keo_luc   TEXT
);
