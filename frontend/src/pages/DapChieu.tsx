import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtSo, fmtThang } from "../lib/api";
import { taiExcel } from "../lib/excel";
import { Bang, Chon, ChonGiaTri, cotXuat, duyNhat, giaTriXuat, Loi, MO_TA_XEP_LOAI, NhanXepLoai, TaiDang, TieuDe, type Cot } from "../components/ui";
import { useUrlState, xoaLocTrang, coLocTrang } from "../lib/dieuHuong";
import { useMoLk } from "../components/HoSoLinhKien";
import { soGon } from "../components/bieuDo";

export interface DapChieuDong {
  nhom: string; ma: string; ten: string; xep_loai: string; phan_loai_dap_chieu: string; noi_san_xuat: string; phan_loai: string;
  nganh: string; he_so: number; ton: number; tb3: number; tb6: number; du_tru: number; ton_du: number; gia_nhap: number | null;
  gia_nhap_nguon: "nhap" | "du_phong" | "khong_co"; gia_tri_ton: number | null; gia_tri_du_tru: number | null; gia_tri_ton_du: number | null; xuat: number[];
}
export interface DapChieuKq { thang_n: string; thang: string[]; moc_so_chi_tiet: string | null; moc_ton_kho: string | null; rows: DapChieuDong[] }

type CheDo = "tat_ca" | "gop_rieng_ktv" | "gop_khong_ktv" | "gop_chung";
const CHE_DO: { v: CheDo; t: string }[] = [
  { v: "tat_ca", t: "Tất cả - không gộp" },
  { v: "gop_rieng_ktv", t: "Gộp chung - riêng kho KTV" },
  { v: "gop_khong_ktv", t: "Gộp chung - không có kho KTV" },
  { v: "gop_chung", t: "Gộp chung" },
];

export default function DapChieu({ t5 = false }: { t5?: boolean }) {
  const [cheDo, setCheDo] = useUrlState<CheDo>("che_do", t5 ? "gop_rieng_ktv" : "tat_ca");
  const [dc, setDc] = useUrlState("dap_chieu", "");
  const [pl, setPl] = useUrlState("phan_loai", "");
  const [xl, setXl] = useUrlState("xep_loai", "");
  const [daLoc, setDaLoc] = useState<DapChieuDong[]>([]);
  const moLk = useMoLk();
  const q = useQuery({ queryKey: [t5 ? "t5" : "dap-chieu", cheDo], queryFn: () => api<DapChieuKq>(`/bao-cao/${t5 ? "t5" : "dap-chieu"}?che_do=${cheDo}`) });

  const rows = q.data?.rows ?? [];
  // Loc o dau trang (nhu o chon tren Sheet); loc tung cot + tim nam trong Bang -> daLoc (dung cho tong + Excel).
  const locTrang = useMemo(
    () => rows.filter((r) => (!dc || r.phan_loai_dap_chieu === dc) && (!pl || r.phan_loai === pl) && (!xl || r.xep_loai === xl)),
    [rows, dc, pl, xl],
  );
  const loc = daLoc;
  const tong = useMemo(() => {
    const s = (f: (r: DapChieuDong) => number | null) => loc.reduce((a, r) => a + (f(r) ?? 0), 0);
    return { ton: s((r) => r.ton), tb3: s((r) => r.tb3), tb6: s((r) => r.tb6), du_tru: s((r) => r.du_tru), ton_du: s((r) => r.ton_du), gt: s((r) => r.gia_tri_ton), gtdt: s((r) => r.gia_tri_du_tru), gttd: s((r) => r.gia_tri_ton_du) };
  }, [loc]);
  const thang = q.data?.thang ?? [];
  const coGia = rows.some((r) => (r.gia_tri_ton ?? 0) > 0);

  const cot: Cot<DapChieuDong>[] = [
    { ten: "Kho", the: "phu" as const, lay: (r) => r.nhom, sx: (r) => r.nhom, loc: "gt" },
    { ten: "Mã", the: "phu" as const, lay: (r) => r.ma, cls: "font-mono text-xs text-primary", sx: (r) => r.ma },
    { ten: "Tên sản phẩm", the: "tieu_de" as const, lay: (r) => <span title={r.ten} className="inline-block max-w-[260px] truncate align-bottom">{r.ten}</span>, sx: (r) => r.ten },
    { ten: "Rủi ro", the: "nhan" as const, lay: (r) => <NhanXepLoai v={r.xep_loai} />, sx: (r) => r.xep_loai, loc: "gt" },
    { ten: "Đắp chiếu", the: "nhan" as const, lay: (r) => r.phan_loai_dap_chieu, sx: (r) => r.phan_loai_dap_chieu, loc: "gt" },
    { ten: "Nơi SX", the: "an" as const, lay: (r) => r.noi_san_xuat, gt: (r) => r.noi_san_xuat, loc: "gt" },
    { ten: "Ngành", the: "an" as const, lay: (r) => r.nganh, gt: (r) => r.nganh, loc: "gt" },
    { ten: "Phân loại", lay: (r) => r.phan_loai, sx: (r) => r.phan_loai, loc: "gt" },
    { ten: "Hệ số", the: "an" as const, lay: (r) => fmtSo(r.he_so, 2), so: true, sx: (r) => r.he_so, loc: "so" },
    { ten: "Tồn hiện tại", lay: (r) => fmtSo(r.ton, 2), so: true, sx: (r) => r.ton, loc: "so" },
    { ten: "TB 3 tháng", lay: (r) => fmtSo(r.tb3), so: true, sx: (r) => r.tb3, loc: "so" },
    { ten: "TB 6 tháng", the: "an" as const, lay: (r) => fmtSo(r.tb6), so: true, sx: (r) => r.tb6, loc: "so" },
    { ten: "SL dự trữ", lay: (r) => fmtSo(r.du_tru), so: true, sx: (r) => r.du_tru, loc: "so" },
    { ten: "Tồn dư", lay: (r) => <span className={r.ton_du < 0 ? "font-semibold text-danger" : ""}>{fmtSo(r.ton_du, 2)}</span>, so: true, sx: (r) => r.ton_du, loc: "so" },
    {
      ten: "Giá nhập", the: "an" as const,
      lay: (r) =>
        r.gia_nhap_nguon === "nhap" ? fmtSo(r.gia_nhap) : (
          <span title={r.gia_nhap_nguon === "du_phong" ? "Tạm dùng giá dự phòng — chưa có giá nhập" : "Chưa có giá nhập lẫn giá dự phòng — tính = 0"} className="italic text-warning">
            {fmtSo(r.gia_nhap ?? 0)}*
          </span>
        ),
      so: true,
      sx: (r) => r.gia_nhap,
      loc: "so",
    },
    { ten: "GT tồn", lay: (r) => fmtSo(r.gia_tri_ton), so: true, sx: (r) => r.gia_tri_ton, loc: "so" },
    { ten: "GT dự trữ", the: "an" as const, lay: (r) => fmtSo(r.gia_tri_du_tru), so: true, sx: (r) => r.gia_tri_du_tru, loc: "so" },
    { ten: "GT tồn dư", the: "an" as const, lay: (r) => fmtSo(r.gia_tri_ton_du), so: true, sx: (r) => r.gia_tri_ton_du, loc: "so" },
    ...thang.map((t, i) => ({ ten: `${i === 0 ? "N " : `N-${i} `}(${fmtThang(t)})`, the: "an" as const, lay: (r: DapChieuDong) => fmtSo(r.xuat[i] || null, 2), so: true, sx: (r: DapChieuDong) => r.xuat[i], loc: "so" as const })),
  ];

  const xuatExcel = () =>
    taiExcel(
      `${t5 ? "canh-bao-t5" : "dap-chieu"}-${q.data?.thang_n}.xlsx`,
      cotXuat(cot).map((c) => c.ten),
      loc.map((r) => cotXuat(cot).map((c) => giaTriXuat(c, r))),
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
        phai={
          <>
            {coLocTrang() && (
              <button className="btn" onClick={xoaLocTrang} title="Bỏ mọi bộ lọc, tìm kiếm, sắp xếp của trang">
                ✕ Xoá lọc
              </button>
            )}
            <button className="btn" onClick={xuatExcel} disabled={!loc.length}>
              ⬇ Tải Excel ({loc.length.toLocaleString("vi-VN")} dòng)
            </button>
          </>
        }
      />
      {!t5 && rows.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {["", "T1", "T2", "T3", "T4", "T5"].map((x) => {
            const r = x ? rows.filter((d) => d.xep_loai === x) : rows;
            return (
              <button key={x} className={`card px-3 py-2 text-left transition ${xl === x ? "border-primary ring-1 ring-primary" : "hover:border-primary"}`} onClick={() => setXl(x)} title={x ? MO_TA_XEP_LOAI[x] : "Tất cả"}>
                <div className="flex items-center gap-1.5 text-xs text-ink-soft">{x ? <NhanXepLoai v={x} /> : "Tất cả"}</div>
                <div className="mt-1 text-lg font-bold tabular-nums">{r.length.toLocaleString("vi-VN")} <span className="text-xs font-normal text-ink-soft">mã</span></div>
                <div className="text-xs tabular-nums text-ink-soft">
                  {coGia ? `GT tồn ${soGon(r.reduce((a, d) => a + (d.gia_tri_ton ?? 0), 0))}` : `SL tồn ${soGon(r.reduce((a, d) => a + d.ton, 0))}`}
                </div>
              </button>
            );
          })}
        </div>
      )}
      <div className="loc-bar">
        <Chon nhan="Chọn kho" giaTri={cheDo} dat={setCheDo} luaChon={CHE_DO} />
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
          rows={locTrang}
          cot={cot}
          idUrl="bang"
          onLoc={setDaLoc}
          timTheo={(r) => `${r.ma} ${r.ten}`}
          onClick={(r) => moLk(r.ma, loc.map((x) => x.ma))}
          tongThe={
            <div className="card grid grid-cols-3 gap-2 bg-primary-soft/60 p-3 text-xs">
              <div>
                <div className="text-ink-soft">Tồn</div>
                <div className="font-semibold tabular-nums">{fmtSo(tong.ton, 0)}</div>
              </div>
              <div>
                <div className="text-ink-soft">SL dự trữ</div>
                <div className="font-semibold tabular-nums">{fmtSo(tong.du_tru)}</div>
              </div>
              <div>
                <div className="text-ink-soft">Tồn dư</div>
                <div className="font-semibold tabular-nums">{fmtSo(tong.ton_du, 0)}</div>
              </div>
            </div>
          }
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
        SL dự trữ = ROUNDUP((TB 3 tháng + Xuất tháng N) / 2 × Hệ số) · TB chia cố định 3 / 6 tháng (tháng không xuất = 0) · Giá có dấu * = chưa có giá nhập: tạm dùng giá dự phòng, không có thì = 0.
      </p>
    </div>
  );
}
