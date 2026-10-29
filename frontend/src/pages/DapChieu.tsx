import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtSo, fmtThang } from "../lib/api";
import { taiExcel } from "../lib/excel";
import { Bang, Chon, ChonGiaTri, duyNhat, Loi, NhanXepLoai, TaiDang, TieuDe, type Cot } from "../components/ui";

export interface DapChieuDong {
  nhom: string; ma: string; ten: string; xep_loai: string; phan_loai_dap_chieu: string; noi_san_xuat: string; phan_loai: string;
  nganh: string; he_so: number; ton: number; tb3: number; tb6: number; du_tru: number; ton_du: number; gia_nhap: number | null;
  gia_nhap_tam: boolean; gia_tri_ton: number | null; gia_tri_du_tru: number | null; gia_tri_ton_du: number | null; xuat: number[];
}
export interface DapChieuKq { thang_n: string; thang: string[]; moc_so_chi_tiet: string | null; moc_ton_kho: string | null; rows: DapChieuDong[] }

type CheDo = "tat_ca" | "gop_rieng_ktv" | "gop_khong_ktv" | "gop_chung";
const CHE_DO: { v: CheDo; t: string }[] = [
  { v: "tat_ca", t: "Tất cả - không gộp" },
  { v: "gop_rieng_ktv", t: "Gộp chung - riêng kho KTV" },
  { v: "gop_khong_ktv", t: "Gộp chung - không có kho KTV" },
  { v: "gop_chung", t: "Gộp chung" },
];

const MO_TA_XEP_LOAI: Record<string, string> = {
  T1: "Tồn dư = 0",
  T2: "Tồn dư > 0, tới 50% SL dự trữ",
  T3: "Tồn dư > 0, 50–100% SL dự trữ",
  T4: "Tồn dư > 100% SL dự trữ",
  T5: "Tồn dư < 0 (nguy cơ thiếu hàng)",
};

export default function DapChieu({ t5 = false }: { t5?: boolean }) {
  const [cheDo, setCheDo] = useState<CheDo>(t5 ? "gop_rieng_ktv" : "tat_ca");
  const [nhom, setNhom] = useState("");
  const [dc, setDc] = useState("");
  const [pl, setPl] = useState("");
  const [xl, setXl] = useState("");
  const q = useQuery({ queryKey: [t5 ? "t5" : "dap-chieu", cheDo], queryFn: () => api<DapChieuKq>(`/bao-cao/${t5 ? "t5" : "dap-chieu"}?che_do=${cheDo}`) });

  const rows = q.data?.rows ?? [];
  const loc = useMemo(
    () => rows.filter((r) => (!nhom || r.nhom === nhom) && (!dc || r.phan_loai_dap_chieu === dc) && (!pl || r.phan_loai === pl) && (!xl || r.xep_loai === xl)),
    [rows, nhom, dc, pl, xl],
  );
  const tong = useMemo(() => {
    const s = (f: (r: DapChieuDong) => number | null) => loc.reduce((a, r) => a + (f(r) ?? 0), 0);
    return { ton: s((r) => r.ton), tb3: s((r) => r.tb3), tb6: s((r) => r.tb6), du_tru: s((r) => r.du_tru), ton_du: s((r) => r.ton_du), gt: s((r) => r.gia_tri_ton), gtdt: s((r) => r.gia_tri_du_tru), gttd: s((r) => r.gia_tri_ton_du) };
  }, [loc]);
  const thang = q.data?.thang ?? [];

  const cot: Cot<DapChieuDong>[] = [
    { ten: "Kho", lay: (r) => r.nhom },
    { ten: "Mã", lay: (r) => r.ma, cls: "font-mono text-xs" },
    { ten: "Tên sản phẩm", lay: (r) => <span title={r.ten} className="inline-block max-w-[260px] truncate align-bottom">{r.ten}</span> },
    { ten: "Rủi ro", lay: (r) => <NhanXepLoai v={r.xep_loai} /> },
    { ten: "Đắp chiếu", lay: (r) => r.phan_loai_dap_chieu },
    { ten: "Nơi SX", lay: (r) => r.noi_san_xuat },
    { ten: "Phân loại", lay: (r) => r.phan_loai },
    { ten: "Hệ số", lay: (r) => fmtSo(r.he_so, 2), so: true },
    { ten: "Tồn hiện tại", lay: (r) => fmtSo(r.ton, 2), so: true },
    { ten: "TB 3 tháng", lay: (r) => fmtSo(r.tb3), so: true },
    { ten: "TB 6 tháng", lay: (r) => fmtSo(r.tb6), so: true },
    { ten: "SL dự trữ", lay: (r) => fmtSo(r.du_tru), so: true },
    { ten: "Tồn dư", lay: (r) => <span className={r.ton_du < 0 ? "font-semibold text-danger" : ""}>{fmtSo(r.ton_du, 2)}</span>, so: true },
    { ten: "Giá nhập", lay: (r) => (r.gia_nhap == null ? "" : <span title={r.gia_nhap_tam ? "Tạm dùng giá dự phòng — chưa có giá nhập" : ""} className={r.gia_nhap_tam ? "italic text-warning" : ""}>{fmtSo(r.gia_nhap)}{r.gia_nhap_tam ? "*" : ""}</span>), so: true },
    { ten: "GT tồn", lay: (r) => fmtSo(r.gia_tri_ton), so: true },
    { ten: "GT dự trữ", lay: (r) => fmtSo(r.gia_tri_du_tru), so: true },
    { ten: "GT tồn dư", lay: (r) => fmtSo(r.gia_tri_ton_du), so: true },
    ...thang.map((t, i) => ({ ten: `${i === 0 ? "N " : `N-${i} `}(${fmtThang(t)})`, lay: (r: DapChieuDong) => fmtSo(r.xuat[i] || null, 2), so: true })),
  ];

  const xuatExcel = () =>
    taiExcel(
      `${t5 ? "canh-bao-t5" : "dap-chieu"}-${q.data?.thang_n}.xlsx`,
      cot.map((c) => c.ten),
      loc.map((r) => [r.nhom, r.ma, r.ten, r.xep_loai, r.phan_loai_dap_chieu, r.noi_san_xuat, r.phan_loai, r.he_so, r.ton, r.tb3, r.tb6, r.du_tru, r.ton_du, r.gia_nhap, r.gia_tri_ton, r.gia_tri_du_tru, r.gia_tri_ton_du, ...r.xuat]),
    );

  return (
    <div>
      <TieuDe
        ten={t5 ? "Cảnh báo T5 — nguy cơ thiếu hàng" : "Báo cáo tồn kho đắp chiếu"}
        moTa={
          q.data && (
            <>
              Tháng N = {fmtThang(q.data.thang_n)} (lũy kế tới {q.data.moc_so_chi_tiet ?? "—"}) · Tồn kho cập nhật {q.data.moc_ton_kho ?? "chưa có"}
              {t5 && " · Đã loại linh kiện thuộc diện cắt mã"}
            </>
          )
        }
        phai={<button className="btn" onClick={xuatExcel} disabled={!loc.length}>⬇ Tải Excel</button>}
      />
      <div className="mb-3 flex flex-wrap gap-3">
        <Chon nhan="Chọn kho" giaTri={cheDo} dat={(v) => (setCheDo(v), setNhom(""))} luaChon={CHE_DO} />
        <ChonGiaTri nhan="Kho" giaTri={nhom} dat={setNhom} ds={duyNhat(rows.map((r) => r.nhom))} />
        <ChonGiaTri nhan="Đắp chiếu" giaTri={dc} dat={setDc} ds={duyNhat(rows.map((r) => r.phan_loai_dap_chieu))} />
        <ChonGiaTri nhan="Phân loại LK" giaTri={pl} dat={setPl} ds={duyNhat(rows.map((r) => r.phan_loai))} />
        {!t5 && <Chon nhan="Xếp loại" giaTri={xl} dat={setXl} luaChon={[{ v: "", t: "Tất cả" }, ...Object.entries(MO_TA_XEP_LOAI).map(([v, t]) => ({ v, t: `${v}: ${t}` }))]} />}
      </div>
      {q.isLoading ? (
        <TaiDang />
      ) : q.error ? (
        <Loi loi={q.error} />
      ) : (
        <Bang
          rows={loc}
          cot={cot}
          timTheo={(r) => `${r.ma} ${r.ten}`}
          dongTong={
            <tr className="bg-primary-soft font-semibold">
              <td colSpan={8}>TỔNG ({loc.length.toLocaleString("vi-VN")} dòng)</td>
              <td className="so">{fmtSo(tong.ton, 2)}</td>
              <td className="so">{fmtSo(tong.tb3)}</td>
              <td className="so">{fmtSo(tong.tb6)}</td>
              <td className="so">{fmtSo(tong.du_tru)}</td>
              <td className="so">{fmtSo(tong.ton_du, 2)}</td>
              <td />
              <td className="so">{fmtSo(tong.gt)}</td>
              <td className="so">{fmtSo(tong.gtdt)}</td>
              <td className="so">{fmtSo(tong.gttd)}</td>
              {thang.map((t, i) => (
                <td key={t} className="so">{fmtSo(loc.reduce((a, r) => a + (r.xuat[i] ?? 0), 0), 2)}</td>
              ))}
            </tr>
          }
        />
      )}
      <p className="mt-2 text-xs text-ink-soft">
        SL dự trữ = ROUNDUP((TB 3 tháng + Xuất tháng N) / 2 × Hệ số) · TB chia cố định 3 / 6 tháng (tháng không xuất = 0) · Giá có dấu * = tạm dùng giá dự phòng, chưa có giá nhập.
      </p>
    </div>
  );
}
