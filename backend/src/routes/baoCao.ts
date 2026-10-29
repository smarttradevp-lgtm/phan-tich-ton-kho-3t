import { Hono } from "hono";
import type { AppEnv } from "../types";
import { baoCaoDapChieu, baoCaoLeadtime, baoCaoThuHoi, docKhaiBao, docThamSoDb, docXuatThang, khoaPhanLoai, phienTonMoiNhat, CHUA_KHAI_BAO, type CheDoGop } from "../lib/duLieuBaoCao";
import { locT5 } from "../lib/tinhToan/dapChieu";
import { dayThang } from "../lib/tinhToan/chung";
import { NHOM_THU_HOI } from "../lib/tinhToan/thuHoi";
import { thangHienTaiVN } from "../lib/vnTime";

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

// Tong quan: so lieu tong hop 3 bao cao + kiem tra chat luong du lieu. Tinh lai tu dau (khong cache) - du lieu nho.
const MUC_LEADTIME = ["1. Thiếu hàng nghiêm trọng", "2. Thiếu hàng", "3. Tới thời điểm đặt hàng", "4. Bình thường", "5. Hết tồn - không tiêu hao", "6. Còn tồn - không tiêu hao"];

baoCao.get("/tong-quan", async (c) => {
  const db = c.env.DB;
  const [dc, lt, th, plLa, khoChuaPl] = await Promise.all([
    baoCaoDapChieu(db, "gop_rieng_ktv"),
    baoCaoLeadtime(db, { gop: false, loaiKho: "cong_ty" }),
    baoCaoThuHoi(db),
    db.prepare("SELECT ten FROM phan_loai_lk").all<{ ten: string }>().then(async (pl) => {
      const co = new Set(pl.results.map((p) => khoaPhanLoai(p.ten)));
      const { results } = await db.prepare("SELECT phan_loai, COUNT(*) AS n FROM lk_khai_bao WHERE phan_loai IS NOT NULL GROUP BY phan_loai").all<{ phan_loai: string; n: number }>();
      return results.filter((r) => !co.has(khoaPhanLoai(r.phan_loai)));
    }),
    db.prepare("SELECT COUNT(*) AS n FROM kho WHERE loai = 'khac' AND nguon = 'import'").first<number>("n"),
  ]);
  const rows = dc.rows;
  const xepLoai = ["T1", "T2", "T3", "T4", "T5"].map((x) => {
    const r = rows.filter((d) => d.xep_loai === x);
    return { xep_loai: x, so_ma: r.length, ton: r.reduce((a, d) => a + d.ton, 0), gia_tri_ton: r.reduce((a, d) => a + d.gia_tri_ton, 0), gia_tri_ton_du: r.reduce((a, d) => a + d.gia_tri_ton_du, 0) };
  });
  const t5 = locT5(rows);
  const dapChieu = new Map<string, { nhom: string; so_ma: number; gia_tri_ton: number }>();
  for (const d of rows) {
    if (d.ton <= 0) continue;
    // Gom B00..B12 / D00..D12 thanh 4 muc so thang khong xuat.
    const k = Number(d.phan_loai_dap_chieu.slice(1));
    const nhom = k === 0 ? "Có xuất tháng này" : k <= 2 ? "1–2 tháng không xuất" : k <= 5 ? "3–5 tháng không xuất" : k <= 11 ? "6–11 tháng không xuất" : "≥ 12 tháng không xuất";
    const g = dapChieu.get(nhom) ?? { nhom, so_ma: 0, gia_tri_ton: 0 };
    g.so_ma++;
    g.gia_tri_ton += d.gia_tri_ton;
    dapChieu.set(nhom, g);
  }
  const thangXh = dc.thang.slice(0, 12).reverse();
  const xuHuong = thangXh.map((t) => {
    const i = dc.thang.indexOf(t);
    return { thang: t, sl: rows.filter((d) => d.nhom !== "Kho KTV chung").reduce((a, d) => a + (d.xuat[i] ?? 0), 0) };
  });
  const leadtime = lt.cua_so.map((d, j) => ({ cua_so: d, dem: MUC_LEADTIME.map((m) => ({ muc: m, so_dong: lt.rows.filter((r) => r.canh_bao[j].toLowerCase() === m.toLowerCase()).length })) }));
  const thuHoi = NHOM_THU_HOI.map((n) => ({ nhom: n, so_dong: th.rows.filter((r) => r.nhom === n).length, sl: th.rows.filter((r) => r.nhom === n).reduce((a, r) => a + r.ton, 0) }));
  const coSo = rows.filter((d) => d.ton > 0 || d.xuat.some((x) => x));
  return c.json({
    thang_n: dc.thang_n,
    moc_ton_kho: dc.moc_ton_kho,
    moc_so_chi_tiet: dc.moc_so_chi_tiet,
    tong: {
      so_ma: rows.length,
      so_ma_co_ton: rows.filter((d) => d.ton > 0).length,
      gia_tri_ton: rows.reduce((a, d) => a + d.gia_tri_ton, 0),
      gia_tri_ton_du_t4: xepLoai[3].gia_tri_ton_du,
      so_ma_t5: t5.length,
      can_dat_leadtime: lt.rows.filter((r) => r.sl_thieu_can_dat > 0 && r.canh_bao[0].match(/^[123]\./)).length,
      sl_thu_hoi_nhom_1_2: thuHoi[0].sl + thuHoi[1].sl,
    },
    xep_loai: xepLoai,
    dap_chieu: ["Có xuất tháng này", "1–2 tháng không xuất", "3–5 tháng không xuất", "6–11 tháng không xuất", "≥ 12 tháng không xuất"].map((n) => dapChieu.get(n) ?? { nhom: n, so_ma: 0, gia_tri_ton: 0 }),
    t5_top: t5.slice(0, 10).map((d) => ({ ma: d.ma, ten: d.ten, nhom: d.nhom, ton: d.ton, du_tru: d.du_tru, ton_du: d.ton_du, phan_loai: d.phan_loai })),
    xu_huong: xuHuong,
    leadtime,
    thu_hoi: thuHoi,
    kiem_tra: {
      lk_chua_phan_loai: coSo.filter((d) => d.phan_loai === CHUA_KHAI_BAO).length,
      lk_gia_tam: coSo.filter((d) => d.gia_nhap_nguon === "du_phong").length,
      lk_gia_0: rows.filter((d) => d.ton > 0 && d.gia_nhap_nguon === "khong_co").length,
      phan_loai_la: plLa,
      kho_chua_phan_loai: khoChuaPl ?? 0,
      kho_ktv_chua_khai_bao: [...new Set(th.rows.filter((r) => r.kho_chua_khai_bao).map((r) => r.ma_kho))].length,
      chua_co_ton_kho: !dc.moc_ton_kho,
      chua_co_so_chi_tiet: !dc.moc_so_chi_tiet,
    },
  });
});

// Chi tiet 1 linh kien: khai bao, ton theo kho (phien moi nhat), xuat theo thang x kho, so chi tiet gan nhat.
baoCao.get("/lk/:ma", async (c) => {
  const db = c.env.DB;
  const ma = (c.req.param("ma") ?? "").trim();
  const ts = await docThamSoDb(db);
  const thang = dayThang(thangHienTaiVN(), ts.so_thang_hien_thi);
  const [kb, phien, xuat, sct, kho] = await Promise.all([
    docKhaiBao(db).then((m) => m.get(ma) ?? null),
    phienTonMoiNhat(db),
    docXuatThang(db, thang, ma),
    db.prepare("SELECT ma_kho, ten_kho, ngay_hach_toan, so_chung_tu, dien_giai, sl_nhap, sl_xuat FROM so_chi_tiet WHERE ma_hang = ? ORDER BY ngay_hach_toan DESC, id DESC LIMIT 50").bind(ma).all(),
    db.prepare("SELECT ma, ten, loai FROM kho").all<{ ma: string; ten: string; loai: string }>(),
  ]);
  const khoMap = new Map(kho.results.map((k) => [k.ma, k]));
  const ton = phien
    ? (await db.prepare("SELECT ma_kho, ten_hang, dau_ky, nhap_kho, xuat_kho, cuoi_ky FROM ton_kho WHERE phien_id = ? AND ma_hang = ? ORDER BY cuoi_ky DESC").bind(phien.id, ma).all<{ ma_kho: string; ten_hang: string | null; dau_ky: number; nhap_kho: number; xuat_kho: number; cuoi_ky: number }>()).results
    : [];
  const tenXuat = xuat.find((x) => x.ten_hang)?.ten_hang ?? null;
  return c.json({
    ma,
    ten: kb?.ten || ton[0]?.ten_hang || tenXuat || ma,
    khai_bao: kb,
    thang,
    moc_ton_kho: phien?.xong_luc ?? null,
    ton: ton.map((t) => ({ ...t, ten_kho: khoMap.get(t.ma_kho)?.ten ?? t.ma_kho, loai_kho: khoMap.get(t.ma_kho)?.loai ?? "khac" })),
    xuat: xuat.map((x) => ({ thang: x.thang, ma_kho: x.ma_kho, ten_kho: khoMap.get(x.ma_kho)?.ten ?? x.ma_kho, loai_kho: khoMap.get(x.ma_kho)?.loai ?? "khac", sl: x.sl })),
    so_chi_tiet: sct.results,
  });
});

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
