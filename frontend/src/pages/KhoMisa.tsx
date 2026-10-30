import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Loi, Modal, TaiDang, ThongBao, TieuDe } from "../components/ui";

// Quan tri > Kho du lieu MISA (docs/KE_HOACH_KHO_MISA.md): app nay la noi nhap MISA goc, cac he thong khac keo qua API.
interface Khoa {
  id: number; ten: string; tien_to: string; quyen: string[]; bat_tat: number; tao_luc: string; tao_boi: string | null;
  dung_cuoi_luc: string | null; phien_ton_da_keo: string | null; phien_ton_keo_luc: string | null;
}
interface Kq {
  hub_la_nguon_ton: boolean; co_khoa_bao: boolean; thong_bao: { phien_ban: string; linh_kien_app: string; luc: string } | null; khoa: Khoa[]; tap_du_lieu: string[];
}
const TEN_TAP: Record<string, string> = { ton_kho: "Tồn kho", so_chi_tiet: "Sổ chi tiết vật tư", xuat_thang: "Xuất kho theo tháng" };

export default function KhoMisa() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["kho-misa"], queryFn: () => api<Kq>("/quan-tri/kho-misa") });
  const lamMoi = () => qc.invalidateQueries({ queryKey: ["kho-misa"] });
  const [tao, setTao] = useState<{ ten: string; quyen: string[] } | null>(null);
  const [khoaMoi, setKhoaMoi] = useState<{ ten: string; khoa: string } | null>(null);
  const [daChep, setDaChep] = useState(false);
  const nguon = useMutation({ mutationFn: (v: boolean) => api("/quan-tri/kho-misa/nguon-ton", { method: "PUT", json: { hub_la_nguon_ton: v } }), onSuccess: lamMoi });
  const taoKhoa = useMutation({
    mutationFn: () => api<{ khoa: string }>("/quan-tri/kho-misa/khoa", { method: "POST", json: tao }),
    onSuccess: (r) => (setKhoaMoi({ ten: tao!.ten, khoa: r.khoa }), setTao(null), lamMoi()),
  });
  const sua = useMutation({ mutationFn: ({ id, ...b }: { id: number; bat_tat?: boolean; quyen?: string[] }) => api(`/quan-tri/kho-misa/khoa/${id}`, { method: "PATCH", json: b }), onSuccess: lamMoi });
  const xoa = useMutation({ mutationFn: (id: number) => api(`/quan-tri/kho-misa/khoa/${id}`, { method: "DELETE" }), onSuccess: lamMoi });
  if (q.isLoading) return <TaiDang />;
  if (q.error) return <Loi loi={q.error} />;
  const d = q.data!;
  return (
    <div className="space-y-4">
      <TieuDe
        ten="Kho dữ liệu MISA"
        moTa="App này là nơi nhập file MISA gốc (tồn kho, sổ chi tiết, xuất tháng). linh-kien-app, DVBH, EO Mua hàng kéo về qua API bằng khoá riêng của từng bên."
      />
      {[nguon.error, taoKhoa.error, sua.error, xoa.error].filter(Boolean).map((e, i) => (
        <Loi key={i} loi={e} />
      ))}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="card-title mb-1">Nguồn tồn kho</h2>
          <p className="mb-3 text-xs text-ink-soft">
            Chưa bật: app này vẫn kéo tồn kho từ linh-kien-app như cũ (giai đoạn chạy song song — Kế toán nhập file ở cả 2 nơi).
            Bật khi chuyển nguồn: Kế toán chỉ nhập ở đây, app này thôi kéo tồn từ linh-kien-app.
          </p>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={d.hub_la_nguon_ton} disabled={nguon.isPending} onChange={(e) => confirm(e.target.checked ? "Bật: app này là nguồn tồn kho, thôi kéo tồn từ linh-kien-app?" : "Tắt: quay lại kéo tồn từ linh-kien-app?") && nguon.mutate(e.target.checked)} />
            <span>
              <b>App này là nguồn tồn kho</b>
              <span className={`ml-2 badge ${d.hub_la_nguon_ton ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{d.hub_la_nguon_ton ? "Đang bật" : "Chưa bật"}</span>
            </span>
          </label>
        </div>
        <div className="card">
          <h2 className="card-title mb-1">Báo phiên mới cho linh-kien-app</h2>
          <p className="mb-2 text-xs text-ink-soft">Nhập xong file tồn kho, app này gọi linh-kien-app kéo về ngay (ngoài ra linh-kien-app tự kiểm tra mỗi giờ).</p>
          {!d.co_khoa_bao ? (
            <ThongBao loai="warning">Chưa cấu hình secret <code>HUB_SYNC_KEY</code> — chưa báo được, linh-kien-app chỉ kéo theo giờ.</ThongBao>
          ) : d.thong_bao ? (
            <div className="text-sm">
              Lần gần nhất {d.thong_bao.luc}: phiên {d.thong_bao.phien_ban} →{" "}
              <b className={d.thong_bao.linh_kien_app === "ok" ? "text-success" : "text-danger"}>{d.thong_bao.linh_kien_app === "ok" ? "đã nhận" : d.thong_bao.linh_kien_app}</b>
            </div>
          ) : (
            <div className="text-sm text-ink-soft">Chưa có lần báo nào.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="card-title">Khoá API đối tác</h2>
            <p className="text-xs text-ink-soft">
              Gửi header <code>X-API-Key</code>. Tài liệu: <code>docs/API_DOI_TAC_MISA.md</code>. Khoá chỉ hiện 1 lần lúc tạo — mất thì xoá, tạo khoá mới.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setTao({ ten: "", quyen: ["ton_kho"] })}>
            + Tạo khoá
          </button>
        </div>
        <div className="overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Bên dùng</th>
                <th>Khoá</th>
                <th>Được đọc</th>
                <th>Dùng lần cuối</th>
                <th>Phiên tồn đã kéo</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.khoa.map((k) => (
                <tr key={k.id}>
                  <td>
                    <b>{k.ten}</b>
                    <div className="text-xs text-ink-soft">
                      tạo {k.tao_luc} · {k.tao_boi}
                    </div>
                  </td>
                  <td className="font-mono text-xs">{k.tien_to}…</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {d.tap_du_lieu.map((t) => (
                        <label key={t} className="chip cursor-pointer">
                          <input
                            type="checkbox"
                            checked={k.quyen.includes(t)}
                            onChange={() => sua.mutate({ id: k.id, quyen: k.quyen.includes(t) ? k.quyen.filter((x) => x !== t) : [...k.quyen, t] })}
                          />
                          {TEN_TAP[t] ?? t}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="text-xs">{k.dung_cuoi_luc ?? "Chưa dùng"}</td>
                  <td className="text-xs">{k.phien_ton_da_keo ? `${k.phien_ton_da_keo} (lúc ${k.phien_ton_keo_luc?.slice(11, 16)})` : "—"}</td>
                  <td>
                    <button className={`badge ${k.bat_tat ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`} onClick={() => sua.mutate({ id: k.id, bat_tat: !k.bat_tat })} title="Bấm để bật / tắt">
                      {k.bat_tat ? "Đang bật" : "Đã tắt"}
                    </button>
                  </td>
                  <td>
                    <button className="btn-danger btn-sm" onClick={() => confirm(`Xoá khoá của “${k.ten}”? Bên đó sẽ không kéo được nữa.`) && xoa.mutate(k.id)}>
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
              {!d.khoa.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-soft">
                    Chưa có khoá nào. Tạo 1 khoá cho linh-kien-app (Tồn kho) trước.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        mo={!!tao}
        dong={() => setTao(null)}
        tieuDe="Tạo khoá API đối tác"
        chan={
          <>
            <button className="btn" onClick={() => setTao(null)}>
              Huỷ
            </button>
            <button className="btn-primary" disabled={!tao?.ten.trim() || !tao.quyen.length || taoKhoa.isPending} onClick={() => taoKhoa.mutate()}>
              Tạo
            </button>
          </>
        }
      >
        {tao && (
          <div className="space-y-3 text-sm">
            <label className="block">
              <div className="mb-0.5 text-xs text-ink-soft">Bên dùng</div>
              <input className="input w-full" placeholder="vd linh-kien-app, DVBH, EO Mua hàng" value={tao.ten} onChange={(e) => setTao({ ...tao, ten: e.target.value })} />
            </label>
            <div>
              <div className="mb-1 text-xs text-ink-soft">Được đọc</div>
              {d.tap_du_lieu.map((t) => (
                <label key={t} className="flex items-center gap-2 py-0.5">
                  <input type="checkbox" checked={tao.quyen.includes(t)} onChange={() => setTao({ ...tao, quyen: tao.quyen.includes(t) ? tao.quyen.filter((x) => x !== t) : [...tao.quyen, t] })} />
                  {TEN_TAP[t] ?? t}
                </label>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        mo={!!khoaMoi}
        dong={() => (setKhoaMoi(null), setDaChep(false))}
        tieuDe={`Khoá cho “${khoaMoi?.ten}”`}
        chan={
          <button className="btn-primary" onClick={() => (setKhoaMoi(null), setDaChep(false))}>
            Tôi đã lưu khoá
          </button>
        }
      >
        <ThongBao loai="warning">Khoá chỉ hiện 1 lần. Đặt vào secret của bên dùng (vd linh-kien-app: <code>HUB_API_KEY</code>), không gửi qua nhóm chat chung.</ThongBao>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-lg bg-subtle p-2 text-xs">{khoaMoi?.khoa}</code>
          <button className="btn btn-sm" onClick={() => khoaMoi && navigator.clipboard?.writeText(khoaMoi.khoa).then(() => setDaChep(true))}>
            {daChep ? "✓ Đã chép" : "Chép"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
