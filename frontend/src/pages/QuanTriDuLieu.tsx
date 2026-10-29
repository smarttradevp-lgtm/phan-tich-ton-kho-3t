import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtSo } from "../lib/api";
import { Loi, TaiDang, ThongBao, TieuDe } from "../components/ui";

interface Kq {
  bang: { bang: string; so_dong: number }[];
  phien_ton: {
    id: number; phien_ban: string; nguon: string; ten_file: string | null; nguoi: string | null; trang_thai: string; ky_tu_ngay: string | null; ky_den_ngay: string | null;
    so_dong: number; bat_dau_luc: string; xong_luc: string | null; dang_dung: boolean;
  }[];
  so_chi_tiet_theo_thang: { thang: string; n: number }[];
  xuat_thang: { thang: string; nguon: string; n: number; sl: number }[];
}

const TEN_BANG: Record<string, string> = {
  so_chi_tiet: "Sổ chi tiết vật tư", xuat_thang: "Xuất tháng tĩnh", ton_kho: "Tồn kho (mọi phiên)", ton_kho_phien: "Phiên tồn kho", lk_khai_bao: "Khai báo linh kiện",
  linh_kien: "Danh mục LK (đồng bộ)", kho: "Kho", import_log: "Lịch sử import", nhat_ky: "Nhật ký thao tác", users: "Người dùng",
};

export default function QuanTriDuLieu() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["quan-tri"], queryFn: () => api<Kq>("/quan-tri/du-lieu") });
  const [ngay, setNgay] = useState("");
  const [giu, setGiu] = useState(5);
  const [kq, setKq] = useState("");
  const xong = (r: { da_xoa: number }) => (setKq(`Đã xoá ${fmtSo(r.da_xoa)} dòng / phiên.`), qc.invalidateQueries());
  const xoaPhien = useMutation({ mutationFn: (id: number) => api<{ da_xoa: number }>(`/quan-tri/phien-ton/${id}`, { method: "DELETE" }), onSuccess: xong });
  const donDep = useMutation({ mutationFn: (b: Record<string, unknown>) => api<{ da_xoa: number }>("/quan-tri/don-dep", { method: "POST", json: b }), onSuccess: xong });
  if (q.isLoading) return <TaiDang />;
  if (q.error) return <Loi loi={q.error} />;
  const d = q.data!;
  return (
    <div className="space-y-4">
      <TieuDe ten="Dữ liệu hệ thống" moTa="Dung lượng từng bảng, các phiên tồn kho, dọn dẹp dữ liệu cũ để D1 không phình to. Thao tác xoá ghi vào Nhật ký." />
      {kq && <ThongBao loai="success">✓ {kq}</ThongBao>}
      {[xoaPhien.error, donDep.error].filter(Boolean).map((e, i) => (
        <Loi key={i} loi={e} />
      ))}
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {d.bang.map((b) => (
          <div key={b.bang} className="card py-3">
            <div className="text-xs text-ink-soft">{TEN_BANG[b.bang] ?? b.bang}</div>
            <div className="text-lg font-bold tabular-nums">{fmtSo(b.so_dong)}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">Phiên tồn kho</h2>
          <div className="flex items-center gap-2 text-sm">
            Giữ
            <input className="input w-16 text-right" type="number" min={1} value={giu} onChange={(e) => setGiu(Number(e.target.value))} />
            phiên mới nhất
            <button className="btn btn-sm" disabled={donDep.isPending} onClick={() => confirm(`Xoá mọi phiên tồn kho cũ, chỉ giữ ${giu} phiên mới nhất?`) && donDep.mutate({ giu_phien_ton: giu })}>
              Dọn phiên cũ
            </button>
          </div>
        </div>
        <div className="max-h-80 overflow-auto rounded-lg border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Nguồn</th>
                <th>File / phiên bản</th>
                <th>Kỳ</th>
                <th className="so">Số dòng</th>
                <th>Xong lúc</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.phien_ton.map((p) => (
                <tr key={p.id}>
                  <td className="tabular-nums">{p.id}</td>
                  <td>{p.nguon === "import" ? "File Excel" : "linh-kien-app"}</td>
                  <td>
                    <span className="inline-block max-w-[240px] truncate align-bottom" title={p.ten_file ?? p.phien_ban}>
                      {p.ten_file ?? p.phien_ban}
                    </span>
                    {p.nguoi && <div className="text-xs text-ink-soft">{p.nguoi}</div>}
                  </td>
                  <td className="text-xs">{p.ky_tu_ngay ? `${p.ky_tu_ngay} → ${p.ky_den_ngay}` : "—"}</td>
                  <td className="so">{fmtSo(p.so_dong)}</td>
                  <td className="text-xs">{p.xong_luc ?? "—"}</td>
                  <td>
                    {p.dang_dung ? <span className="badge bg-green-100 text-green-700">Đang dùng</span> : <span className="badge bg-slate-100 text-slate-600">{p.trang_thai === "xong" ? "Cũ" : p.trang_thai}</span>}
                  </td>
                  <td>
                    {!p.dang_dung && (
                      <button className="btn-danger btn-sm" onClick={() => confirm(`Xoá phiên tồn kho #${p.id}?`) && xoaPhien.mutate(p.id)}>
                        Xoá
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="card-title mb-1">Sổ chi tiết theo tháng</h2>
          <p className="mb-2 text-xs text-ink-soft">Chỉ xoá được tháng đã có xuất tháng tĩnh (đã chốt) — báo cáo đắp chiếu không mất số liệu. Leadtime chỉ cần 30 ngày gần nhất.</p>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            Xoá phát sinh trước ngày
            <input className="input" type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
            <button className="btn-danger btn-sm" disabled={!ngay || donDep.isPending} onClick={() => confirm(`Xoá sổ chi tiết trước ${ngay} (tháng đã chốt tĩnh)?`) && donDep.mutate({ so_chi_tiet_truoc: ngay })}>
              Dọn
            </button>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th className="so">Số dòng</th>
                  <th>Xuất tháng tĩnh</th>
                </tr>
              </thead>
              <tbody>
                {d.so_chi_tiet_theo_thang.map((s) => {
                  const t = s.thang.replace("-", "");
                  const tinh = d.xuat_thang.find((x) => x.thang === t);
                  return (
                    <tr key={s.thang}>
                      <td>{s.thang}</td>
                      <td className="so">{fmtSo(s.n)}</td>
                      <td>{tinh ? <span className="badge bg-green-100 text-green-700">Đã có ({tinh.nguon === "chot" ? "hệ thống chốt" : "import"})</span> : <span className="text-xs text-ink-soft">Tính động từ sổ</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title mb-2">Xuất tháng tĩnh</h2>
          <div className="max-h-80 overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th>Nguồn</th>
                  <th className="so">Số dòng</th>
                  <th className="so">Tổng SL xuất</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.xuat_thang.map((x) => (
                  <tr key={x.thang + x.nguon}>
                    <td>{`${x.thang.slice(4)}/${x.thang.slice(0, 4)}`}</td>
                    <td>{x.nguon === "chot" ? "Hệ thống chốt" : "Import"}</td>
                    <td className="so">{fmtSo(x.n)}</td>
                    <td className="so">{fmtSo(x.sl, 2)}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => confirm(`Xoá xuất tĩnh tháng ${x.thang}? (tháng này sẽ tính lại từ sổ chi tiết nếu còn)`) && donDep.mutate({ xuat_thang: x.thang })}>
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
