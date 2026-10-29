// Chot tinh xuat theo thang: thang M duoc ghi co dinh vao xuat_thang (nguon 'chot') khi da qua tham_so.so_thang_chot_tinh
// thang (VD 3 thang: thang 10/2026 chot tu 01/02/2027). Thang da co trong xuat_thang (import tinh hoac chot truoc) bo qua.
// Truoc khi chot, bao cao cong dong tu so_chi_tiet (lib/duLieuBaoCao.ts docXuatThang).
import { thangLui } from "./tinhToan/chung";
import { docThamSoDb } from "./duLieuBaoCao";
import { nowVN, thangHienTaiVN } from "./vnTime";

export async function chotThangTinh(db: D1Database): Promise<string[]> {
  const ts = await docThamSoDb(db);
  // Thang < moc nay da qua du so thang chot.
  const moc = thangLui(thangHienTaiVN(), ts.so_thang_chot_tinh);
  const mocNgay = `${moc.slice(0, 4)}-${moc.slice(4, 6)}-01`;
  const { results } = await db
    .prepare(
      `SELECT DISTINCT substr(ngay_hach_toan, 1, 4) || substr(ngay_hach_toan, 6, 2) AS thang FROM so_chi_tiet
       WHERE ngay_hach_toan < ? AND substr(ngay_hach_toan, 1, 4) || substr(ngay_hach_toan, 6, 2) NOT IN (SELECT DISTINCT thang FROM xuat_thang)`,
    )
    .bind(mocNgay)
    .all<{ thang: string }>();
  const thang = results.map((r) => r.thang);
  if (!thang.length) return [];
  const luc = nowVN();
  await db.batch([
    ...thang.map((t) =>
      db
        .prepare(
          `INSERT INTO xuat_thang (thang, ma_kho, ma_hang, ten_hang, sl_xuat, nguon, ngay_ghi)
           SELECT ?1, ma_kho, ma_hang, MAX(ten_hang), SUM(sl_xuat), 'chot', ?2 FROM so_chi_tiet
           WHERE ngay_hach_toan >= ?3 AND ngay_hach_toan < ?4 AND sl_xuat <> 0 GROUP BY ma_kho, ma_hang`,
        )
        .bind(t, luc, `${t.slice(0, 4)}-${t.slice(4, 6)}-01`, `${thangLui(t, -1).slice(0, 4)}-${thangLui(t, -1).slice(4, 6)}-01`),
    ),
    db.prepare("INSERT INTO import_log (loai, nguoi, luc, so_dong, tu_ngay, den_ngay, ghi_chu) VALUES ('chot_thang', 'he-thong', ?, ?, ?, ?, ?)").bind(
      luc,
      thang.length,
      [...thang].sort()[0],
      [...thang].sort().at(-1),
      `Chốt tĩnh tháng: ${thang.sort().join(", ")}`,
    ),
  ]);
  return thang;
}
