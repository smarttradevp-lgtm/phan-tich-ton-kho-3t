import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Bang, Loi, Modal, TaiDang, ThongBao, TieuDe, type Cot } from "../components/ui";

interface U { email: string; ten: string | null; vai_tro: string; trang_thai: string; created_at: string; updated_at: string }

const VAI_TRO = [
  { v: "xem", t: "Chỉ xem", mo: "Xem mọi báo cáo, tải Excel." },
  { v: "nhap_lieu", t: "Nhập liệu", mo: "+ Nhập dữ liệu, sửa cài đặt." },
  { v: "admin", t: "Admin", mo: "+ Quản lý người dùng, dữ liệu hệ thống, nhật ký." },
];
const TRANG_THAI: Record<string, { t: string; c: string }> = {
  cho_duyet: { t: "Chờ duyệt", c: "bg-amber-100 text-amber-800" },
  da_duyet: { t: "Đang hoạt động", c: "bg-green-100 text-green-700" },
  khoa: { t: "Đã khoá", c: "bg-slate-200 text-slate-600" },
};

export default function NguoiDung({ toi }: { toi: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: () => api<{ rows: U[] }>("/users") });
  const [them, setThem] = useState<{ email: string; ten: string; vai_tro: string } | null>(null);
  const lamMoi = () => qc.invalidateQueries({ queryKey: ["users"] });
  const sua = useMutation({ mutationFn: ({ email, ...b }: { email: string; vai_tro?: string; trang_thai?: string }) => api(`/users/${encodeURIComponent(email)}`, { method: "PATCH", json: b }), onSuccess: lamMoi });
  const dangXuat = useMutation({ mutationFn: (email: string) => api(`/users/${encodeURIComponent(email)}/dang-xuat`, { method: "POST" }), onSuccess: lamMoi });
  const xoa = useMutation({ mutationFn: (email: string) => api(`/users/${encodeURIComponent(email)}`, { method: "DELETE" }), onSuccess: lamMoi });
  const tao = useMutation({ mutationFn: () => api("/users", { method: "POST", json: them }), onSuccess: () => (setThem(null), lamMoi()) });
  if (q.isLoading) return <TaiDang />;
  if (q.error) return <Loi loi={q.error} />;
  const rows = q.data!.rows;
  const cho = rows.filter((u) => u.trang_thai === "cho_duyet");
  const cot: Cot<U>[] = [
    {
      ten: "Tài khoản",
      sx: (u) => u.email,
      lay: (u) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{(u.ten || u.email)[0].toUpperCase()}</span>
          <div>
            <div className="font-medium">{u.ten || "—"}</div>
            <div className="text-xs text-ink-soft">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      ten: "Vai trò",
      sx: (u) => u.vai_tro,
      lay: (u) => (
        <select className="input" disabled={u.email === toi} value={u.vai_tro} onChange={(e) => sua.mutate({ email: u.email, vai_tro: e.target.value })}>
          {VAI_TRO.map((v) => (
            <option key={v.v} value={v.v}>
              {v.t}
            </option>
          ))}
        </select>
      ),
    },
    { ten: "Trạng thái", sx: (u) => u.trang_thai, lay: (u) => <span className={`badge ${TRANG_THAI[u.trang_thai]?.c}`}>{TRANG_THAI[u.trang_thai]?.t ?? u.trang_thai}</span> },
    { ten: "Tạo lúc", lay: (u) => <span className="text-xs text-ink-soft">{u.created_at}</span>, sx: (u) => u.created_at },
    {
      ten: "",
      lay: (u) =>
        u.email === toi ? (
          <span className="text-xs text-ink-soft">(bạn)</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {u.trang_thai !== "da_duyet" && (
              <button className="btn-primary btn-sm" onClick={() => sua.mutate({ email: u.email, trang_thai: "da_duyet" })}>
                {u.trang_thai === "khoa" ? "Mở khoá" : "Duyệt"}
              </button>
            )}
            {u.trang_thai === "da_duyet" && (
              <button className="btn btn-sm" onClick={() => confirm(`Khoá ${u.email}? (đăng xuất mọi thiết bị)`) && sua.mutate({ email: u.email, trang_thai: "khoa" })}>
                Khoá
              </button>
            )}
            <button className="btn btn-sm" title="Buộc đăng nhập lại trên mọi thiết bị" onClick={() => dangXuat.mutate(u.email)}>
              Đăng xuất mọi nơi
            </button>
            <button className="btn-danger btn-sm" onClick={() => confirm(`Xoá tài khoản ${u.email}?`) && xoa.mutate(u.email)}>
              Xoá
            </button>
          </div>
        ),
    },
  ];
  return (
    <div className="space-y-4">
      <TieuDe
        ten="Người dùng"
        moTa="Đăng nhập bằng Google. Tài khoản mới tự đăng nhập sẽ ở trạng thái Chờ duyệt; thêm trước email để người đó vào được ngay."
        phai={
          <button className="btn-primary" onClick={() => setThem({ email: "", ten: "", vai_tro: "xem" })}>
            + Thêm người dùng
          </button>
        }
      />
      {cho.length > 0 && <ThongBao loai="warning">{cho.length} tài khoản đang chờ duyệt.</ThongBao>}
      <div className="grid gap-2 sm:grid-cols-3">
        {VAI_TRO.map((v) => (
          <div key={v.v} className="card py-2 text-sm">
            <b>{v.t}</b> <span className="chip ml-1">{rows.filter((u) => u.vai_tro === v.v && u.trang_thai === "da_duyet").length}</span>
            <div className="text-xs text-ink-soft">{v.mo}</div>
          </div>
        ))}
      </div>
      {[sua.error, dangXuat.error, xoa.error].filter(Boolean).map((e, i) => (
        <Loi key={i} loi={e} />
      ))}
      <Bang rows={rows} cot={cot} timTheo={(u) => `${u.email} ${u.ten ?? ""}`} />
      <Modal
        mo={!!them}
        dong={() => setThem(null)}
        tieuDe="Thêm người dùng"
        chan={
          <>
            <button className="btn" onClick={() => setThem(null)}>
              Huỷ
            </button>
            <button className="btn-primary" disabled={tao.isPending || !them?.email} onClick={() => tao.mutate()}>
              Thêm
            </button>
          </>
        }
      >
        {them && (
          <div className="space-y-3 text-sm">
            <label className="block">
              <div className="mb-0.5 text-xs text-ink-soft">Email Google</div>
              <input className="input w-full" type="email" value={them.email} onChange={(e) => setThem({ ...them, email: e.target.value })} placeholder="ten@gmail.com" />
            </label>
            <label className="block">
              <div className="mb-0.5 text-xs text-ink-soft">Tên hiển thị (tuỳ chọn)</div>
              <input className="input w-full" value={them.ten} onChange={(e) => setThem({ ...them, ten: e.target.value })} />
            </label>
            <div>
              <div className="mb-1 text-xs text-ink-soft">Vai trò</div>
              {VAI_TRO.map((v) => (
                <label key={v.v} className="flex items-start gap-2 py-1">
                  <input type="radio" checked={them.vai_tro === v.v} onChange={() => setThem({ ...them, vai_tro: v.v })} className="mt-1" />
                  <span>
                    <b>{v.t}</b> <span className="text-xs text-ink-soft">{v.mo}</span>
                  </span>
                </label>
              ))}
            </div>
            {tao.error && <Loi loi={tao.error} />}
          </div>
        )}
      </Modal>
    </div>
  );
}
