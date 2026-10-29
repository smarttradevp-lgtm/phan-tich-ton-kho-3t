import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtSo, fmtThang } from "../lib/api";
import { moTrang } from "../lib/dieuHuong";
import { BieuDoCot, BieuDoThanh, soGon } from "../components/bieuDo";
import { useMoLk } from "../components/ChiTietLk";
import { Loi, MO_TA_XEP_LOAI, NhanXepLoai, O, TaiDang, TieuDe } from "../components/ui";

interface Kq {
  thang_n: string; moc_ton_kho: string | null; moc_so_chi_tiet: string | null;
  tong: { so_ma: number; so_ma_co_ton: number; gia_tri_ton: number; gia_tri_ton_du_t4: number; so_ma_t5: number; can_dat_leadtime: number; sl_thu_hoi_nhom_1_2: number };
  xep_loai: { xep_loai: string; so_ma: number; ton: number; gia_tri_ton: number; gia_tri_ton_du: number }[];
  dap_chieu: { nhom: string; so_ma: number; gia_tri_ton: number }[];
  t5_top: { ma: string; ten: string; nhom: string; ton: number; du_tru: number; ton_du: number; phan_loai: string }[];
  xu_huong: { thang: string; sl: number }[];
  leadtime: { cua_so: number; dem: { muc: string; so_dong: number }[] }[];
  thu_hoi: { nhom: string; so_dong: number; sl: number }[];
  kiem_tra: {
    lk_chua_phan_loai: number; lk_gia_tam: number; lk_gia_0: number; phan_loai_la: { phan_loai: string; n: number }[]; kho_chua_phan_loai: number;
    kho_ktv_chua_khai_bao: number; chua_co_ton_kho: boolean; chua_co_so_chi_tiet: boolean;
  };
}

const MO_TA_NHOM: Record<string, string> = {
  "Nhóm 1": "KTV đã nghỉ → thu hồi toàn bộ",
  "Nhóm 2": "Không xuất trong kỳ → xem xét thu hồi",
  "Nhóm 3": "Tồn trên chuẩn 2 tuần → điều chỉnh",
  "Nhóm 4": "Còn lại → không xử lý",
};

export default function TongQuan() {
  const q = useQuery({ queryKey: ["tong-quan"], queryFn: () => api<Kq>("/bao-cao/tong-quan") });
  const moLk = useMoLk();
  const [cuaSo, setCuaSo] = useState(0);
  if (q.isLoading) return <TaiDang chu="Đang tính 4 báo cáo…" />;
  if (q.error) return <Loi loi={q.error} />;
  const d = q.data!;
  const kt = d.kiem_tra;
  const canhBao = [
    kt.chua_co_ton_kho && { muc: "Chưa có tồn kho — các báo cáo đang tính tồn = 0.", link: "nhap-du-lieu", nut: "Nhập tồn kho" },
    kt.chua_co_so_chi_tiet && { muc: "Chưa có sổ chi tiết vật tư — Cảnh báo leadtime chưa có tiêu hao.", link: "nhap-du-lieu", nut: "Nhập sổ chi tiết" },
    kt.lk_chua_phan_loai > 0 && { muc: `${fmtSo(kt.lk_chua_phan_loai)} linh kiện có phát sinh nhưng chưa khai báo phân loại (dùng hệ số mặc định).`, link: "cai-dat/lk", nut: "Khai báo" },
    kt.phan_loai_la.length > 0 && { muc: `${kt.phan_loai_la.length} tên phân loại không có trong danh sách (${kt.phan_loai_la.slice(0, 3).map((p) => `“${p.phan_loai}”`).join(", ")}…) — hệ số thu hồi = 0.`, link: "cai-dat/phan-loai", nut: "Gộp phân loại" },
    kt.kho_chua_phan_loai > 0 && { muc: `${fmtSo(kt.kho_chua_phan_loai)} kho mới từ file import chưa chọn loại (đang tính “Khác”).`, link: "cai-dat/kho", nut: "Phân loại kho" },
    kt.kho_ktv_chua_khai_bao > 0 && { muc: `${fmtSo(kt.kho_ktv_chua_khai_bao)} kho KTV chưa khai báo trạng thái làm việc / phòng ban (coi như đang làm).`, link: "cai-dat/kho", nut: "Khai báo kho" },
    kt.lk_gia_0 > 0 && { muc: `${fmtSo(kt.lk_gia_0)} mã có tồn nhưng chưa có giá nhập lẫn giá dự phòng — giá trị tồn tính = 0.`, link: "cai-dat/lk", nut: "Nhập giá" },
  ].filter(Boolean) as { muc: string; link: string; nut: string }[];
  const lt = d.leadtime[cuaSo];
  // Chua co gia nhap lan gia du phong -> bieu do theo SO LUONG / SO MA thay vi gia tri (tranh bieu do toan 0).
  const coGia = d.tong.gia_tri_ton > 0;
  const tongSl = d.xep_loai.reduce((a, x) => a + x.ton, 0);

  return (
    <div className="space-y-5">
      <TieuDe
        ten="Tổng quan tồn kho 3T"
        moTa={
          <>
            Tháng N = {fmtThang(d.thang_n)} · Tồn kho cập nhật {d.moc_ton_kho ?? "chưa có"} · Sổ chi tiết tới {d.moc_so_chi_tiet ?? "chưa có"}
          </>
        }
        phai={
          <button className="btn" onClick={() => q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? "Đang tính…" : "⟳ Tính lại"}
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {coGia ? (
          <O nhan="Giá trị tồn kho" so={soGon(d.tong.gia_tri_ton)} icon="tien" phu={`${fmtSo(d.tong.so_ma_co_ton)} mã có tồn · giá nhập (chưa có → dự phòng)`} onClick={() => moTrang("dap-chieu")} />
        ) : (
          <O nhan="Số lượng tồn kho" so={soGon(tongSl)} icon="kho" phu={`${fmtSo(d.tong.so_ma_co_ton)} mã có tồn · chưa có giá nhập → chưa tính giá trị`} onClick={() => moTrang("dap-chieu")} />
        )}
        <O nhan="Nguy cơ thiếu hàng (T5)" so={fmtSo(d.tong.so_ma_t5)} mau="danger" icon="canh-bao" phu="mã có tồn dư < 0, đã loại LK cắt mã" onClick={() => moTrang("t5")} />
        <O nhan="Cần đặt hàng (leadtime)" so={fmtSo(d.tong.can_dat_leadtime)} mau="warning" icon="dong-ho" phu={`dòng mức 1–3 theo tiêu hao ${d.leadtime[0]?.cua_so ?? 7} ngày, kho công ty`} onClick={() => moTrang("leadtime")} />
        <O nhan="Đề xuất thu hồi (Nhóm 1 + 2)" so={fmtSo(d.tong.sl_thu_hoi_nhom_1_2, 0)} icon="thu-hoi" phu="số lượng tồn ở kho KTV" onClick={() => moTrang("thu-hoi")} />
      </div>

      {canhBao.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/60">
          <h2 className="card-title mb-2 text-amber-900">Kiểm tra dữ liệu ({canhBao.length})</h2>
          <ul className="space-y-1.5 text-sm">
            {canhBao.map((c) => (
              <li key={c.muc} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-amber-900">⚠ {c.muc}</span>
                <a className="btn btn-sm" href={`#/${c.link}`}>
                  {c.nut} →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="card-title">Xuất kho 12 tháng — kho công ty</h2>
            <span className="text-xs text-ink-soft">Số lượng, tháng gần nhất lũy kế</span>
          </div>
          <BieuDoCot data={d.xu_huong.map((x) => ({ nhan: `${x.thang.slice(4, 6)}/${x.thang.slice(2, 4)}`, gia_tri: x.sl }))} donVi="SL" />
        </div>
        <div className="card">
          <h2 className="card-title mb-3">{coGia ? "Giá trị tồn" : "Số lượng tồn"} theo xếp loại rủi ro</h2>
          <BieuDoThanh
            data={d.xep_loai.map((x) => ({
              nhan: (
                <span className="flex items-center gap-2">
                  <NhanXepLoai v={x.xep_loai} />
                  <span className="truncate text-ink-soft">{MO_TA_XEP_LOAI[x.xep_loai]}</span>
                </span>
              ),
              gia_tri: coGia ? x.gia_tri_ton : x.ton,
              phu: `${fmtSo(x.so_ma)} mã${coGia && x.xep_loai === "T4" ? ` · tồn dư ${soGon(x.gia_tri_ton_du)}` : ""}`,
              nguy_co: x.xep_loai === "T5",
            }))}
            dinhDang={soGon}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card">
          <h2 className="card-title mb-3">Tồn theo thời gian không xuất (đắp chiếu)</h2>
          <BieuDoThanh data={d.dap_chieu.map((x) => ({ nhan: x.nhom, gia_tri: coGia ? x.gia_tri_ton : x.so_ma, phu: coGia ? `${fmtSo(x.so_ma)} mã có tồn` : undefined }))} dinhDang={coGia ? soGon : undefined} />
          <p className="mt-2 text-xs text-ink-soft">{coGia ? "Giá trị tồn" : "Số mã có tồn"}, gom theo số tháng liên tiếp không xuất (B00–B12).</p>
        </div>
        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="card-title">Cảnh báo leadtime — kho công ty</h2>
            <select className="input py-1 text-xs" value={cuaSo} onChange={(e) => setCuaSo(Number(e.target.value))}>
              {d.leadtime.map((l, i) => (
                <option key={l.cua_so} value={i}>
                  Tiêu hao {l.cua_so} ngày
                </option>
              ))}
            </select>
          </div>
          {lt && <BieuDoThanh data={lt.dem.map((m) => ({ nhan: m.muc, gia_tri: m.so_dong, nguy_co: m.muc.startsWith("1.") }))} />}
        </div>
        <div className="card">
          <h2 className="card-title mb-3">Thu hồi kho KTV theo nhóm</h2>
          <BieuDoThanh data={d.thu_hoi.map((t) => ({ nhan: `${t.nhom} — ${MO_TA_NHOM[t.nhom]}`, gia_tri: t.sl, phu: `${fmtSo(t.so_dong)} dòng kho × mã` }))} />
          <p className="mt-2 text-xs text-ink-soft">Số lượng tồn ở kho KTV.</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="card-title">10 mã thiếu nhiều nhất (T5)</h2>
          <a className="text-sm text-primary hover:underline" href="#/t5">
            Xem tất cả →
          </a>
        </div>
        <div className="overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Kho</th>
                <th>Phân loại</th>
                <th className="so">Tồn</th>
                <th className="so">SL dự trữ</th>
                <th className="so">Thiếu</th>
              </tr>
            </thead>
            <tbody>
              {d.t5_top.map((r) => (
                <tr key={`${r.nhom}-${r.ma}`} className="cursor-pointer hover:bg-subtle" onClick={() => moLk(r.ma)}>
                  <td className="font-mono text-xs text-primary">{r.ma}</td>
                  <td>
                    <span className="inline-block max-w-[320px] truncate align-bottom" title={r.ten}>
                      {r.ten}
                    </span>
                  </td>
                  <td>{r.nhom}</td>
                  <td className="text-ink-soft">{r.phan_loai}</td>
                  <td className="so">{fmtSo(r.ton, 2)}</td>
                  <td className="so">{fmtSo(r.du_tru)}</td>
                  <td className="so font-semibold text-danger">{fmtSo(-r.ton_du, 2)}</td>
                </tr>
              ))}
              {!d.t5_top.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-soft">
                    Không có mã nào thiếu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
