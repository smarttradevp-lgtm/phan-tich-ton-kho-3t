import { Hono } from "hono";
import type { AppEnv } from "../types";
import { baoCaoDapChieu, baoCaoLeadtime, baoCaoThuHoi, phienTonMoiNhat, type CheDoGop } from "../lib/duLieuBaoCao";
import { locT5 } from "../lib/tinhToan/dapChieu";

// 4 bao cao - moi vai tro da duyet deu xem duoc. Tinh luc doc tu du lieu goc (khong luu ket qua).
const baoCao = new Hono<AppEnv>();

const CHE_DO: CheDoGop[] = ["tat_ca", "gop_rieng_ktv", "gop_khong_ktv", "gop_chung"];
const cheDo = (v: string | undefined): CheDoGop => (CHE_DO.includes(v as CheDoGop) ? (v as CheDoGop) : "tat_ca");

baoCao.get("/dap-chieu", async (c) => c.json(await baoCaoDapChieu(c.env.DB, cheDo(c.req.query("che_do")))));

baoCao.get("/t5", async (c) => {
  const kq = await baoCaoDapChieu(c.env.DB, cheDo(c.req.query("che_do") ?? "gop_rieng_ktv"));
  return c.json({ ...kq, rows: locT5(kq.rows) });
});

baoCao.get("/leadtime", async (c) => {
  const loai = c.req.query("loai_kho");
  return c.json(
    await baoCaoLeadtime(c.env.DB, {
      gop: c.req.query("gop") === "1",
      loaiKho: loai === "ktv" || loai === "tat_ca" ? loai : "cong_ty",
    }),
  );
});

baoCao.get("/thu-hoi", async (c) => c.json(await baoCaoThuHoi(c.env.DB)));

// Moc du lieu cho thanh trang thai + Tong quan.
baoCao.get("/moc-du-lieu", async (c) => {
  const db = c.env.DB;
  const [phien, sct, xt, lk, imp] = await Promise.all([
    phienTonMoiNhat(db),
    db.prepare("SELECT MIN(ngay_hach_toan) AS tu, MAX(ngay_hach_toan) AS den, COUNT(*) AS n FROM so_chi_tiet").first(),
    db.prepare("SELECT MIN(thang) AS tu, MAX(thang) AS den, COUNT(DISTINCT thang) AS so_thang FROM xuat_thang").first(),
    db.prepare("SELECT COUNT(*) AS n, MAX(dong_bo_luc) AS luc FROM linh_kien").first(),
    db.prepare("SELECT loai, MAX(luc) AS luc FROM import_log GROUP BY loai").all(),
  ]);
  return c.json({ ton_kho: phien, so_chi_tiet: sct, xuat_thang_tinh: xt, linh_kien: lk, import_gan_nhat: imp.results });
});

export default baoCao;
