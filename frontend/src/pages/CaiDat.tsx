import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtSo } from "../lib/api";
import { Bang, Chon, ChonGiaTri, duyNhat, Loi, TaiDang, TieuDe, type Cot } from "../components/ui";

type Tab = "lk" | "phan_loai" | "kho" | "tham_so";

export default function CaiDat({ coTheGhi }: { coTheGhi: boolean }) {
  const [tab, setTab] = useState<Tab>("lk");
  const TABS: { v: Tab; t: string }[] = [
    { v: "lk", t: "Khai báo linh kiện" },
    { v: "phan_loai", t: "Phân loại & thu hồi" },
    { v: "kho", t: "Kho" },
    { v: "tham_so", t: "Tham số" },
  ];
  return (
    <div>
      <TieuDe ten="Cài đặt" moTa={coTheGhi ? undefined : "Tài khoản chỉ xem — không sửa được."} />
      <div className="mb-4 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.v} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.v ? "border-primary text-primary" : "border-transparent text-ink-soft"}`} onClick={() => setTab(t.v)}>
            {t.t}
          </button>
        ))}
      </div>
      {tab === "lk" && <KhaiBaoLk coTheGhi={coTheGhi} />}
      {tab === "phan_loai" && <PhanLoai coTheGhi={coTheGhi} />}
      {tab === "kho" && <Kho coTheGhi={coTheGhi} />}
      {tab === "tham_so" && <ThamSo coTheGhi={coTheGhi} />}
    </div>
  );
}

// ---------------------------------------------------------------- Khai bao LK
interface LkRow {
  ma: string; ten: string | null; nhom_lk: string | null; gia_du_phong: number | null; co_trong_danh_muc: number; phan_loai: string | null; nganh: string | null;
  noi_san_xuat: string | null; he_so_du_tru: number | null; leadtime: number | null; doi_tac: string | null; nhom_tuong_duong: string | null;
  gia_nhap: number | null; gia_nhap_nguon: string | null; nguoi_cap_nhat: string | null; ngay_cap_nhat: string | null;
}

const TRUONG_LK: { k: keyof LkRow; t: string; so?: boolean }[] = [
  { k: "phan_loai", t: "Phân loại" },
  { k: "nganh", t: "Ngành" },
  { k: "noi_san_xuat", t: "Nơi SX (SX/NK)" },
  { k: "he_so_du_tru", t: "Hệ số dự trữ", so: true },
  { k: "leadtime", t: "Leadtime (ngày)", so: true },
  { k: "doi_tac", t: "Đối tác" },
  { k: "nhom_tuong_duong", t: "Nhóm tương đương" },
  { k: "gia_nhap", t: "Giá nhập", so: true },
];

function KhaiBaoLk({ coTheGhi }: { coTheGhi: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cd-lk"], queryFn: () => api<{ rows: LkRow[] }>("/cai-dat/lk") });
  const pl = useQuery({ queryKey: ["cd-phan-loai"], queryFn: () => api<{ phan_loai: { ten: string }[] }>("/cai-dat/phan-loai") });
  const [loc, setLoc] = useState<"" | "chua_pl" | "chua_gia" | "gia_tam">("");
  const [phanLoai, setPhanLoai] = useState("");
  const [sua, setSua] = useState<LkRow | null>(null);
  const rows = q.data?.rows ?? [];
  const hien = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!phanLoai || r.phan_loai === phanLoai) &&
          (loc === "" || (loc === "chua_pl" && !r.phan_loai) || (loc === "chua_gia" && r.gia_nhap == null) || (loc === "gia_tam" && r.gia_nhap == null && (r.gia_du_phong ?? 0) > 0)),
      ),
    [rows, loc, phanLoai],
  );
  const luu = useMutation({
    mutationFn: (r: LkRow) => api(`/cai-dat/lk/${encodeURIComponent(r.ma)}`, { method: "PUT", json: r }),
    onSuccess: () => (setSua(null), qc.invalidateQueries()),
  });
  const cot: Cot<LkRow>[] = [
    { ten: "Mã", lay: (r) => r.ma, cls: "font-mono text-xs" },
    { ten: "Tên", lay: (r) => <span title={r.ten ?? ""} className="inline-block max-w-[260px] truncate align-bottom">{r.ten}{!r.co_trong_danh_muc && <span className="ml-1 text-xs text-warning">(ngoài danh mục)</span>}</span> },
    { ten: "Nhóm", lay: (r) => r.nhom_lk },
    ...TRUONG_LK.map((f) => ({ ten: f.t, so: f.so, lay: (r: LkRow) => (f.so ? fmtSo(r[f.k] as number | null) : (r[f.k] as string | null) ?? <span className="text-ink-soft">—</span>) })),
    { ten: "Giá dự phòng", lay: (r) => fmtSo(r.gia_du_phong), so: true },
    { ten: "", lay: (r) => coTheGhi && <button className="btn" onClick={(e) => (e.stopPropagation(), setSua(r))}>Sửa</button> },
  ];
  if (q.isLoading) return <TaiDang />;
  if (q.error) return <Loi loi={q.error} />;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        <Chon nhan="Lọc" giaTri={loc} dat={setLoc} luaChon={[{ v: "", t: "Tất cả" }, { v: "chua_pl", t: "Chưa có phân loại" }, { v: "chua_gia", t: "Chưa có giá nhập" }, { v: "gia_tam", t: "Đang tạm dùng giá dự phòng" }]} />
        <ChonGiaTri nhan="Phân loại" giaTri={phanLoai} dat={setPhanLoai} ds={duyNhat(rows.map((r) => r.phan_loai))} />
      </div>
      <Bang rows={hien} cot={cot} timTheo={(r) => `${r.ma} ${r.ten ?? ""}`} onClick={coTheGhi ? setSua : undefined} />
      {sua && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSua(null)}>
          <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-semibold">{sua.ma}</h3>
            <div className="mb-3 text-sm text-ink-soft">{sua.ten}</div>
            <div className="grid grid-cols-2 gap-2">
              {TRUONG_LK.map((f) => (
                <label key={f.k} className="text-sm">
                  <div className="text-xs text-ink-soft">{f.t}</div>
                  {f.k === "phan_loai" ? (
                    <select className="input w-full" value={sua.phan_loai ?? ""} onChange={(e) => setSua({ ...sua, phan_loai: e.target.value || null })}>
                      <option value="">— chưa khai báo —</option>
                      {(pl.data?.phan_loai ?? []).map((p) => (
                        <option key={p.ten}>{p.ten}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input w-full"
                      type={f.so ? "number" : "text"}
                      value={(sua[f.k] as string | number | null) ?? ""}
                      onChange={(e) => setSua({ ...sua, [f.k]: e.target.value === "" ? null : f.so ? Number(e.target.value) : e.target.value })}
                    />
                  )}
                </label>
              ))}
            </div>
            {luu.error && <div className="mt-2"><Loi loi={luu.error} /></div>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => setSua(null)}>Huỷ</button>
              <button className="btn-primary" disabled={luu.isPending} onClick={() => luu.mutate(sua)}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Phan loai + ma tran thu hoi
const NHOM = ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"];
const DANH_GIA = ["Thu hồi toàn bộ", "Theo dõi tiếp", "Xem xét lý do tồn để thu hồi đúng hạn", "Không xử lý"];

function PhanLoai({ coTheGhi }: { coTheGhi: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cd-phan-loai"], queryFn: () => api<{ phan_loai: { ten: string; he_so_thu_hoi: number }[]; ma_tran: { phan_loai: string; nhom: string; danh_gia: string }[] }>("/cai-dat/phan-loai") });
  const [ds, setDs] = useState<{ ten: string; ten_cu?: string; he_so_thu_hoi: number; danh_gia: Record<string, string> }[]>([]);
  useEffect(() => {
    if (!q.data) return;
    setDs(
      q.data.phan_loai.map((p) => ({
        ten: p.ten,
        ten_cu: p.ten,
        he_so_thu_hoi: p.he_so_thu_hoi,
        danh_gia: Object.fromEntries(q.data.ma_tran.filter((m) => m.phan_loai === p.ten).map((m) => [m.nhom, m.danh_gia])),
      })),
    );
  }, [q.data]);
  const luu = useMutation({
    mutationFn: () =>
      api("/cai-dat/phan-loai", {
        method: "PUT",
        json: {
          phan_loai: ds.map((p) => ({ ten: p.ten, ten_cu: p.ten_cu, he_so_thu_hoi: p.he_so_thu_hoi })),
          ma_tran: ds.flatMap((p) => NHOM.filter((n) => p.danh_gia[n]).map((n) => ({ phan_loai: p.ten, nhom: n, danh_gia: p.danh_gia[n] }))),
        },
      }),
    onSuccess: () => qc.invalidateQueries(),
  });
  if (q.isLoading) return <TaiDang />;
  return (
    <div>
      <p className="mb-3 text-sm text-ink-soft">Phân loại linh kiện dùng chung cho mọi báo cáo; hệ số + đánh giá theo nhóm dùng cho báo cáo thu hồi DVBH. Đổi tên phân loại sẽ đổi luôn khai báo của các linh kiện đang dùng tên cũ.</p>
      <div className="overflow-auto rounded-xl border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Phân loại</th>
              <th className="so">Hệ số thu hồi</th>
              {NHOM.map((n) => (
                <th key={n}>{n}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {ds.map((p, i) => (
              <tr key={i}>
                <td><input className="input w-80" disabled={!coTheGhi} value={p.ten} onChange={(e) => setDs(ds.map((x, j) => (j === i ? { ...x, ten: e.target.value } : x)))} /></td>
                <td className="so"><input className="input w-20 text-right" type="number" disabled={!coTheGhi} value={p.he_so_thu_hoi} onChange={(e) => setDs(ds.map((x, j) => (j === i ? { ...x, he_so_thu_hoi: Number(e.target.value) } : x)))} /></td>
                {NHOM.map((n) => (
                  <td key={n}>
                    <select className="input" disabled={!coTheGhi} value={p.danh_gia[n] ?? ""} onChange={(e) => setDs(ds.map((x, j) => (j === i ? { ...x, danh_gia: { ...x.danh_gia, [n]: e.target.value } } : x)))}>
                      <option value="">—</option>
                      {[...new Set([...DANH_GIA, p.danh_gia[n]].filter(Boolean))].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </td>
                ))}
                <td>{coTheGhi && <button className="btn" onClick={() => setDs(ds.filter((_, j) => j !== i))}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {coTheGhi && (
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={() => setDs([...ds, { ten: "", he_so_thu_hoi: 0, danh_gia: {} }])}>+ Thêm phân loại</button>
          <button className="btn-primary" disabled={luu.isPending} onClick={() => luu.mutate()}>Lưu</button>
          {luu.isSuccess && <span className="self-center text-sm text-success">Đã lưu</span>}
          {luu.error && <Loi loi={luu.error} />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Kho
interface KhoRow {
  ma: string; ten: string; loai: string; ten_khac: string[]; nguon: string; ma_ktv: string | null; lam_viec: number | null; phong_ban: string | null; khu_vuc: string | null;
  lam_viec_tay: number | null; phong_ban_tay: string | null; khu_vuc_tay: string | null;
}
const LOAI_KHO = [
  { v: "cong_ty", t: "Kho công ty" },
  { v: "ktv", t: "Kho KTV" },
  { v: "khac", t: "Khác (vẫn vào báo cáo)" },
  { v: "bo_qua", t: "Bỏ qua" },
];

function Kho({ coTheGhi }: { coTheGhi: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cd-kho"], queryFn: () => api<{ rows: KhoRow[] }>("/cai-dat/kho") });
  const [loai, setLoai] = useState("");
  const luu = useMutation({ mutationFn: ({ ma, ...b }: { ma: string } & Record<string, unknown>) => api(`/cai-dat/kho/${encodeURIComponent(ma)}`, { method: "PUT", json: b }), onSuccess: () => qc.invalidateQueries() });
  const rows = (q.data?.rows ?? []).filter((r) => !loai || r.loai === loai);
  const cot: Cot<KhoRow>[] = [
    { ten: "Mã kho", lay: (r) => r.ma, cls: "font-mono text-xs" },
    { ten: "Tên", lay: (r) => r.ten },
    {
      ten: "Loại",
      lay: (r) => (
        <select className="input" disabled={!coTheGhi} value={r.loai} onChange={(e) => luu.mutate({ ma: r.ma, loai: e.target.value })}>
          {LOAI_KHO.map((l) => (
            <option key={l.v} value={l.v}>{l.t}</option>
          ))}
        </select>
      ),
    },
    {
      ten: "Làm việc",
      lay: (r) =>
        r.loai !== "ktv" ? "" : (
          <select className="input" disabled={!coTheGhi} value={r.lam_viec_tay == null ? "" : String(r.lam_viec_tay)} onChange={(e) => luu.mutate({ ma: r.ma, lam_viec_tay: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">Theo đồng bộ ({r.lam_viec == null ? "chưa rõ" : r.lam_viec ? "Làm" : "Nghỉ"})</option>
            <option value="1">Làm</option>
            <option value="0">Nghỉ</option>
          </select>
        ),
    },
    { ten: "Phòng ban", lay: (r) => (r.loai !== "ktv" ? "" : <ODieuChinh coTheGhi={coTheGhi} giaTri={r.phong_ban_tay} dongBo={r.phong_ban} luu={(v) => luu.mutate({ ma: r.ma, phong_ban_tay: v })} />) },
    { ten: "Khu vực", lay: (r) => (r.loai !== "ktv" ? "" : <ODieuChinh coTheGhi={coTheGhi} giaTri={r.khu_vuc_tay} dongBo={r.khu_vuc} luu={(v) => luu.mutate({ ma: r.ma, khu_vuc_tay: v })} />) },
    { ten: "Tên khác (khớp file)", lay: (r) => <span className="text-xs text-ink-soft">{r.ten_khac.join("; ")}</span> },
    { ten: "Nguồn", lay: (r) => r.nguon },
  ];
  if (q.isLoading) return <TaiDang />;
  return (
    <div>
      <p className="mb-3 text-sm text-ink-soft">Kho công ty / Khác: tính riêng từng kho trong báo cáo đắp chiếu, leadtime. Kho KTV: gộp thành “Kho KTV chung” + dùng cho báo cáo thu hồi. Bỏ qua: loại khỏi mọi báo cáo. Ô trống = theo dữ liệu đồng bộ từ linh-kien-app.</p>
      <div className="mb-3">
        <Chon nhan="Loại" giaTri={loai} dat={setLoai} luaChon={[{ v: "", t: "Tất cả" }, ...LOAI_KHO]} />
      </div>
      <Bang rows={rows} cot={cot} timTheo={(r) => `${r.ma} ${r.ten} ${r.ten_khac.join(" ")}`} />
    </div>
  );
}

function ODieuChinh({ giaTri, dongBo, luu, coTheGhi }: { giaTri: string | null; dongBo: string | null; luu: (v: string | null) => void; coTheGhi: boolean }) {
  const [v, setV] = useState(giaTri ?? "");
  return <input className="input w-32" disabled={!coTheGhi} placeholder={dongBo ?? "Chưa khai báo"} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (giaTri ?? "") && luu(v.trim() || null)} />;
}

// ---------------------------------------------------------------- Tham so
const NHAN_THAM_SO: Record<string, string> = {
  he_so_du_tru_mac_dinh: "Hệ số dự trữ mặc định (Đắp chiếu, LK chưa khai báo)",
  so_thang_hien_thi: "Số tháng xuất hiển thị",
  cua_so_ngay: "Cửa sổ tiêu hao (ngày)",
  leadtime_mac_dinh: "Leadtime mặc định (ngày)",
  he_so_nk_mac_dinh: "Hệ số mặc định (Leadtime, LK chưa khai báo)",
  nguong_thieu_nghiem_trong: "Ngưỡng thiếu nghiêm trọng (số ngày dư <)",
  nguong_thieu: "Ngưỡng thiếu hàng (số ngày dư <)",
  nguong_toi_diem_dat: "Ngưỡng tới thời điểm đặt (số ngày dư ≤)",
  tan_suat_it: "Ít tiêu hao: tiêu hao 30 ngày ≤",
  tan_suat_nhieu: "Tiêu nhiều: TH30 ≥ / TH14 ≥ / TH7 ≥",
  tan_suat_deu: "Tiêu đều: TH30 ≥ / TH14 ≥ / TH7 ≥",
  so_ky_2_tuan_mac_dinh: "Số kỳ 2 tuần khi không biết kỳ xuất KTV (thu hồi)",
  phan_loai_chua_cai_dat: "Phân loại gán cho LK chưa khai báo (thu hồi)",
  so_thang_chot_tinh: "Chốt tĩnh xuất tháng sau (tháng)",
};

function ThamSo({ coTheGhi }: { coTheGhi: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cd-tham-so"], queryFn: () => api<{ tham_so: Record<string, unknown> }>("/cai-dat/tham-so") });
  const [ts, setTs] = useState<Record<string, unknown> | null>(null);
  useEffect(() => setTs(q.data?.tham_so ?? null), [q.data]);
  const luu = useMutation({ mutationFn: () => api("/cai-dat/tham-so", { method: "PUT", json: ts }), onSuccess: () => qc.invalidateQueries() });
  if (!ts) return <TaiDang />;
  return (
    <div className="max-w-3xl">
      <div className="grid gap-2">
        {Object.entries(ts).map(([k, v]) => (
          <label key={k} className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-sm">
            <span>{NHAN_THAM_SO[k] ?? k}</span>
            {Array.isArray(v) ? (
              <span className="flex gap-1">
                {v.map((x, i) => (
                  <input key={i} className="input w-20 text-right" type="number" disabled={!coTheGhi} value={x as number} onChange={(e) => setTs({ ...ts, [k]: v.map((y, j) => (j === i ? Number(e.target.value) : y)) })} />
                ))}
              </span>
            ) : (
              <input className="input w-64 text-right" type={typeof v === "number" ? "number" : "text"} disabled={!coTheGhi} value={v as string | number} onChange={(e) => setTs({ ...ts, [k]: typeof v === "number" ? Number(e.target.value) : e.target.value })} />
            )}
          </label>
        ))}
      </div>
      {coTheGhi && (
        <div className="mt-3 flex items-center gap-2">
          <button className="btn-primary" disabled={luu.isPending} onClick={() => luu.mutate()}>Lưu tham số</button>
          {luu.isSuccess && <span className="text-sm text-success">Đã lưu</span>}
        </div>
      )}
    </div>
  );
}
