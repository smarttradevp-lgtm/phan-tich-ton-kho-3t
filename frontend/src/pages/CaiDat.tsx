import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtSo } from "../lib/api";
import { taiExcel } from "../lib/excel";
import { Bang, Chon, ChonGiaTri, duyNhat, Icon, Loi, Modal, TaiDang, ThongBao, TieuDe, type Cot } from "../components/ui";
import { useMoLk } from "../components/ChiTietLk";

const TIEU_DE: Record<string, { ten: string; moTa: string }> = {
  lk: { ten: "Khai báo linh kiện", moTa: "Phân loại, ngành, hệ số dự trữ, leadtime, giá nhập từng mã. Ô trống = dùng mặc định ở Tham số." },
  "phan-loai": { ten: "Phân loại & ma trận thu hồi", moTa: "Danh sách phân loại dùng chung mọi báo cáo; hệ số + đánh giá theo nhóm dùng cho báo cáo thu hồi DVBH." },
  kho: { ten: "Kho", moTa: "Loại kho quyết định kho vào báo cáo nào; thông tin KTV (làm việc, phòng ban, khu vực) cho báo cáo thu hồi." },
  "tham-so": { ten: "Tham số tính toán", moTa: "Hệ số / ngưỡng / cửa sổ ngày dùng trong công thức. Đổi tham số → mọi báo cáo tính lại ngay." },
};

export default function CaiDat({ tab, coTheGhi }: { tab: string; coTheGhi: boolean }) {
  const td = TIEU_DE[tab] ?? TIEU_DE.lk;
  return (
    <div>
      <TieuDe ten={td.ten} moTa={<>{td.moTa}{!coTheGhi && <b className="ml-1 text-warning">Tài khoản chỉ xem — không sửa được.</b>}</>} />
      {tab === "lk" && <KhaiBaoLk coTheGhi={coTheGhi} />}
      {tab === "phan-loai" && <PhanLoai coTheGhi={coTheGhi} />}
      {tab === "kho" && <Kho coTheGhi={coTheGhi} />}
      {tab === "tham-so" && <ThamSo coTheGhi={coTheGhi} />}
    </div>
  );
}


// ---------------------------------------------------------------- Khai bao LK
interface LkRow {
  ma: string; ten: string | null; nhom_lk: string | null; gia_du_phong: number | null; co_trong_danh_muc: number; phan_loai: string | null; nganh: string | null;
  noi_san_xuat: string | null; he_so_du_tru: number | null; leadtime: number | null; doi_tac: string | null; nhom_tuong_duong: string | null;
  gia_nhap: number | null; gia_nhap_nguon: string | null; nguoi_cap_nhat: string | null; ngay_cap_nhat: string | null;
}

const TRUONG_LK: { k: keyof LkRow; t: string; so?: boolean; hangLoat?: boolean }[] = [
  { k: "phan_loai", t: "Phân loại", hangLoat: true },
  { k: "nganh", t: "Ngành", hangLoat: true },
  { k: "noi_san_xuat", t: "Nơi SX (SX/NK)", hangLoat: true },
  { k: "he_so_du_tru", t: "Hệ số dự trữ", so: true, hangLoat: true },
  { k: "leadtime", t: "Leadtime (ngày)", so: true, hangLoat: true },
  { k: "doi_tac", t: "Đối tác", hangLoat: true },
  { k: "nhom_tuong_duong", t: "Nhóm tương đương", hangLoat: true },
  { k: "gia_nhap", t: "Giá nhập", so: true },
];
type LocLk = "" | "chua_pl" | "chua_gia" | "gia_tam" | "ngoai_dm";
const NGUON_GIA: Record<string, string> = { import: "Import", tay: "Nhập tay", drive: "Google Drive" };

function OTruong({ f, giaTri, dat, dsPhanLoai }: { f: (typeof TRUONG_LK)[number]; giaTri: string | number | null; dat: (v: string | number | null) => void; dsPhanLoai: string[] }) {
  if (f.k === "phan_loai")
    return (
      <select className="input w-full" value={(giaTri as string) ?? ""} onChange={(e) => dat(e.target.value || null)}>
        <option value="">— chưa khai báo —</option>
        {dsPhanLoai.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
    );
  return <input className="input w-full" type={f.so ? "number" : "text"} value={giaTri ?? ""} onChange={(e) => dat(e.target.value === "" ? null : f.so ? Number(e.target.value) : e.target.value)} />;
}

function KhaiBaoLk({ coTheGhi }: { coTheGhi: boolean }) {
  const qc = useQueryClient();
  const moLk = useMoLk();
  const q = useQuery({ queryKey: ["cd-lk"], queryFn: () => api<{ rows: LkRow[] }>("/cai-dat/lk") });
  const pl = useQuery({ queryKey: ["cd-phan-loai"], queryFn: () => api<{ phan_loai: { ten: string }[] }>("/cai-dat/phan-loai") });
  const dsPhanLoai = (pl.data?.phan_loai ?? []).map((p) => p.ten);
  const [loc, setLoc] = useState<LocLk>("");
  const [phanLoai, setPhanLoai] = useState("");
  const [nganh, setNganh] = useState("");
  const [sua, setSua] = useState<LkRow | null>(null);
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [hangLoat, setHangLoat] = useState<Record<string, string | number | null> | null>(null);
  const rows = q.data?.rows ?? [];
  const dem = useMemo(
    () => ({
      chua_pl: rows.filter((r) => !r.phan_loai).length,
      chua_gia: rows.filter((r) => r.gia_nhap == null).length,
      gia_tam: rows.filter((r) => r.gia_nhap == null && (r.gia_du_phong ?? 0) > 0).length,
      ngoai_dm: rows.filter((r) => !r.co_trong_danh_muc).length,
    }),
    [rows],
  );
  const hien = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!phanLoai || r.phan_loai === phanLoai) &&
          (!nganh || r.nganh === nganh) &&
          (loc === "" ||
            (loc === "chua_pl" && !r.phan_loai) ||
            (loc === "chua_gia" && r.gia_nhap == null) ||
            (loc === "gia_tam" && r.gia_nhap == null && (r.gia_du_phong ?? 0) > 0) ||
            (loc === "ngoai_dm" && !r.co_trong_danh_muc)),
      ),
    [rows, loc, phanLoai, nganh],
  );
  const luu = useMutation({
    mutationFn: (r: LkRow) => api(`/cai-dat/lk/${encodeURIComponent(r.ma)}`, { method: "PUT", json: r }),
    onSuccess: () => (setSua(null), qc.invalidateQueries()),
  });
  const luuHangLoat = useMutation({
    mutationFn: () => api<{ so_ma: number }>("/cai-dat/lk/hang-loat", { method: "POST", json: { ma: [...chon], gia_tri: hangLoat } }),
    onSuccess: () => (setHangLoat(null), setChon(new Set()), qc.invalidateQueries()),
  });
  const cot: Cot<LkRow>[] = [
    { ten: "Mã", lay: (r) => r.ma, cls: "font-mono text-xs", sx: (r) => r.ma },
    {
      ten: "Tên",
      lay: (r) => (
        <span title={r.ten ?? ""} className="inline-block max-w-[260px] truncate align-bottom">
          {r.ten}
          {!r.co_trong_danh_muc && <span className="ml-1 text-xs text-warning">(ngoài danh mục)</span>}
        </span>
      ),
      sx: (r) => r.ten,
    },
    ...TRUONG_LK.filter((f) => f.k !== "gia_nhap").map((f) => ({
      ten: f.t,
      so: f.so,
      sx: (r: LkRow) => r[f.k] as string | number | null,
      lay: (r: LkRow) => (f.so ? fmtSo(r[f.k] as number | null, 2) : (r[f.k] as string | null) ?? <span className="text-ink-soft">—</span>),
    })),
    {
      ten: "Giá nhập",
      so: true,
      sx: (r) => r.gia_nhap ?? r.gia_du_phong,
      lay: (r) =>
        r.gia_nhap != null ? (
          <span title={`Nguồn: ${NGUON_GIA[r.gia_nhap_nguon ?? ""] ?? "—"}`}>{fmtSo(r.gia_nhap)}</span>
        ) : (r.gia_du_phong ?? 0) > 0 ? (
          <span className="italic text-warning" title="Chưa có giá nhập — đang tạm dùng giá dự phòng">
            {fmtSo(r.gia_du_phong)}*
          </span>
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
    { ten: "Cập nhật", lay: (r) => <span className="text-xs text-ink-soft">{r.ngay_cap_nhat?.slice(0, 16)}</span>, sx: (r) => r.ngay_cap_nhat },
    {
      ten: "",
      lay: (r) => (
        <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm" onClick={() => moLk(r.ma)} title="Xem tồn / xuất">
            Xem
          </button>
          {coTheGhi && (
            <button className="btn btn-sm" onClick={() => setSua(r)}>
              Sửa
            </button>
          )}
        </span>
      ),
    },
  ];
  const xuatExcel = () =>
    taiExcel(
      "khai-bao-linh-kien.xlsx",
      ["Mã sản phẩm", "Tên sản phẩm", ...TRUONG_LK.map((f) => f.t), "Giá dự phòng", "Nguồn giá nhập", "Người cập nhật", "Ngày cập nhật"],
      hien.map((r) => [r.ma, r.ten, ...TRUONG_LK.map((f) => r[f.k] as string | number | null), r.gia_du_phong, NGUON_GIA[r.gia_nhap_nguon ?? ""] ?? null, r.nguoi_cap_nhat, r.ngay_cap_nhat]),
    );
  if (q.isLoading) return <TaiDang />;
  if (q.error) return <Loi loi={q.error} />;
  const NUT_LOC: { v: LocLk; t: string; n: number }[] = [
    { v: "", t: "Tất cả", n: rows.length },
    { v: "chua_pl", t: "Chưa phân loại", n: dem.chua_pl },
    { v: "chua_gia", t: "Chưa có giá nhập", n: dem.chua_gia },
    { v: "gia_tam", t: "Đang tạm dùng giá dự phòng", n: dem.gia_tam },
    { v: "ngoai_dm", t: "Ngoài danh mục", n: dem.ngoai_dm },
  ];
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {NUT_LOC.map((b) => (
          <button key={b.v} className={`chip ${loc === b.v ? "border-primary bg-primary-soft font-semibold text-primary" : "hover:border-primary"}`} onClick={() => setLoc(b.v)}>
            {b.t} <b className="tabular-nums">{b.n.toLocaleString("vi-VN")}</b>
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <ChonGiaTri nhan="Phân loại" giaTri={phanLoai} dat={setPhanLoai} ds={duyNhat(rows.map((r) => r.phan_loai))} />
        <ChonGiaTri nhan="Ngành" giaTri={nganh} dat={setNganh} ds={duyNhat(rows.map((r) => r.nganh))} />
        <button className="btn ml-auto" onClick={xuatExcel}>
          <Icon ten="tai-xuong" /> Tải Excel ({hien.length.toLocaleString("vi-VN")})
        </button>
      </div>
      {coTheGhi && chon.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary-soft px-3 py-2 text-sm">
          Đã chọn <b>{chon.size.toLocaleString("vi-VN")}</b> mã
          <button className="btn-primary btn-sm" onClick={() => setHangLoat({})}>
            Sửa hàng loạt
          </button>
          <button className="btn btn-sm" onClick={() => setChon(new Set())}>
            Bỏ chọn
          </button>
        </div>
      )}
      <Bang
        rows={hien}
        cot={cot}
        timTheo={(r) => `${r.ma} ${r.ten ?? ""}`}
        onClick={coTheGhi ? setSua : (r) => moLk(r.ma)}
        chon={coTheGhi ? chon : undefined}
        datChon={setChon}
        khoa={(r) => r.ma}
      />
      <Modal
        mo={!!sua}
        dong={() => setSua(null)}
        tieuDe={
          <>
            <span className="font-mono">{sua?.ma}</span> <span className="font-normal text-ink-soft">{sua?.ten}</span>
          </>
        }
        chan={
          <>
            <button className="btn" onClick={() => setSua(null)}>
              Huỷ
            </button>
            <button className="btn-primary" disabled={luu.isPending} onClick={() => sua && luu.mutate(sua)}>
              Lưu
            </button>
          </>
        }
      >
        {sua && (
          <div className="grid grid-cols-2 gap-3">
            {TRUONG_LK.map((f) => (
              <label key={f.k} className="text-sm">
                <div className="mb-0.5 text-xs text-ink-soft">{f.t}</div>
                <OTruong f={f} giaTri={sua[f.k] as string | number | null} dat={(v) => setSua({ ...sua, [f.k]: v })} dsPhanLoai={dsPhanLoai} />
              </label>
            ))}
            {sua.gia_nhap == null && (sua.gia_du_phong ?? 0) > 0 && <p className="col-span-2 text-xs text-warning">Chưa có giá nhập — báo cáo đang tạm dùng giá dự phòng {fmtSo(sua.gia_du_phong)}.</p>}
            {luu.error && (
              <div className="col-span-2">
                <Loi loi={luu.error} />
              </div>
            )}
          </div>
        )}
      </Modal>
      <Modal
        mo={!!hangLoat}
        dong={() => setHangLoat(null)}
        tieuDe={`Sửa hàng loạt ${chon.size.toLocaleString("vi-VN")} mã`}
        chan={
          <>
            <button className="btn" onClick={() => setHangLoat(null)}>
              Huỷ
            </button>
            <button className="btn-primary" disabled={luuHangLoat.isPending || !Object.keys(hangLoat ?? {}).length} onClick={() => luuHangLoat.mutate()}>
              Áp dụng
            </button>
          </>
        }
      >
        {hangLoat && (
          <div className="space-y-2">
            <p className="text-xs text-ink-soft">Tick trường cần đổi. Để trống giá trị = xoá khai báo trường đó (về mặc định).</p>
            {TRUONG_LK.filter((f) => f.hangLoat).map((f) => {
              const bat = f.k in hangLoat;
              return (
                <div key={f.k} className="grid grid-cols-[160px_1fr] items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={bat}
                      onChange={() => {
                        const h = { ...hangLoat };
                        if (bat) delete h[f.k];
                        else h[f.k] = null;
                        setHangLoat(h);
                      }}
                    />
                    {f.t}
                  </label>
                  {bat ? <OTruong f={f} giaTri={hangLoat[f.k]} dat={(v) => setHangLoat({ ...hangLoat, [f.k]: v })} dsPhanLoai={dsPhanLoai} /> : <span className="text-xs text-ink-soft">giữ nguyên</span>}
                </div>
              );
            })}
            {luuHangLoat.error && <Loi loi={luuHangLoat.error} />}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------- Phan loai + ma tran thu hoi
const NHOM = ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"];
const MO_TA_NHOM: Record<string, string> = { "Nhóm 1": "KTV đã nghỉ", "Nhóm 2": "Không xuất trong kỳ", "Nhóm 3": "Tồn trên chuẩn", "Nhóm 4": "Còn lại" };
const DANH_GIA = ["Thu hồi toàn bộ", "Theo dõi tiếp", "Xem xét lý do tồn để thu hồi đúng hạn", "Không xử lý"];

interface PlKq {
  phan_loai: { ten: string; he_so_thu_hoi: number; so_lk: number }[];
  ma_tran: { phan_loai: string; nhom: string; danh_gia: string }[];
  la: { ten: string; so_lk: number; goi_y: string | null }[];
  chua_phan_loai: number;
}

function PhanLoai({ coTheGhi }: { coTheGhi: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cd-phan-loai"], queryFn: () => api<PlKq>("/cai-dat/phan-loai") });
  const [ds, setDs] = useState<{ ten: string; ten_cu?: string; he_so_thu_hoi: number; so_lk: number; danh_gia: Record<string, string> }[]>([]);
  const [gopVao, setGopVao] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!q.data) return;
    setDs(
      q.data.phan_loai.map((p) => ({
        ten: p.ten,
        ten_cu: p.ten,
        he_so_thu_hoi: p.he_so_thu_hoi,
        so_lk: p.so_lk,
        danh_gia: Object.fromEntries(q.data.ma_tran.filter((m) => m.phan_loai === p.ten).map((m) => [m.nhom, m.danh_gia])),
      })),
    );
    setGopVao(Object.fromEntries(q.data.la.filter((l) => l.goi_y).map((l) => [l.ten, l.goi_y!])));
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
  const gop = useMutation({ mutationFn: (b: { tu: string; den: string }) => api<{ so_lk: number }>("/cai-dat/phan-loai/gop", { method: "POST", json: b }), onSuccess: () => qc.invalidateQueries() });
  if (q.isLoading) return <TaiDang />;
  const la = q.data?.la ?? [];
  return (
    <div className="space-y-4">
      {la.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/50">
          <h2 className="card-title mb-1">Phân loại cần chuẩn hoá ({la.length})</h2>
          <p className="mb-2 text-xs text-ink-soft">Tên phân loại trong khai báo LK không khớp đúng danh sách (khác hoa / thường hoặc chưa có). Báo cáo đã tự quy tên khác hoa / thường; tên chưa có → hệ số thu hồi 0. Gộp để sửa hẳn khai báo.</p>
          <div className="space-y-1.5">
            {la.map((l) => (
              <div key={l.ten} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-80 truncate font-medium" title={l.ten}>
                  “{l.ten}”
                </span>
                <span className="chip">{l.so_lk} LK</span>
                {coTheGhi && (
                  <>
                    <span className="text-ink-soft">gộp vào</span>
                    <select className="input" value={gopVao[l.ten] ?? ""} onChange={(e) => setGopVao({ ...gopVao, [l.ten]: e.target.value })}>
                      <option value="">— chọn —</option>
                      {ds.map((p) => (
                        <option key={p.ten}>{p.ten}</option>
                      ))}
                    </select>
                    <button className="btn btn-sm" disabled={!gopVao[l.ten] || gop.isPending} onClick={() => gop.mutate({ tu: l.ten, den: gopVao[l.ten] })}>
                      Gộp
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {gop.data && <p className="mt-2 text-xs text-success">Đã gộp {gop.data.so_lk} LK.</p>}
        </div>
      )}
      <div className="overflow-auto rounded-xl border border-line bg-white">
        <table className="tbl">
          <thead>
            <tr>
              <th>Phân loại</th>
              <th className="so">Số LK</th>
              <th className="so">Hệ số thu hồi</th>
              {NHOM.map((n) => (
                <th key={n}>
                  {n}
                  <div className="font-normal normal-case">{MO_TA_NHOM[n]}</div>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {ds.map((p, i) => (
              <tr key={i}>
                <td>
                  <input className="input w-72" disabled={!coTheGhi} value={p.ten} onChange={(e) => setDs(ds.map((x, j) => (j === i ? { ...x, ten: e.target.value } : x)))} />
                </td>
                <td className="so text-ink-soft">{fmtSo(p.so_lk)}</td>
                <td className="so">
                  <input className="input w-20 text-right" type="number" step="0.5" disabled={!coTheGhi} value={p.he_so_thu_hoi} onChange={(e) => setDs(ds.map((x, j) => (j === i ? { ...x, he_so_thu_hoi: Number(e.target.value) } : x)))} />
                </td>
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
                <td>
                  {coTheGhi && (
                    <button className="btn btn-sm" title={p.so_lk ? "Đang có LK dùng phân loại này" : "Xoá"} onClick={() => (!p.so_lk || confirm(`${p.so_lk} LK đang dùng “${p.ten}”. Vẫn xoá khỏi danh sách?`)) && setDs(ds.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-soft">{fmtSo(q.data?.chua_phan_loai ?? 0)} linh kiện chưa khai báo phân loại → báo cáo thu hồi dùng phân loại “Chưa cài đặt”. Đổi tên phân loại sẽ đổi luôn khai báo của các LK đang dùng tên cũ.</p>
      {coTheGhi && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn" onClick={() => setDs([...ds, { ten: "", he_so_thu_hoi: 0, so_lk: 0, danh_gia: {} }])}>
            + Thêm phân loại
          </button>
          <button className="btn-primary" disabled={luu.isPending} onClick={() => luu.mutate()}>
            Lưu thay đổi
          </button>
          {luu.isSuccess && <span className="text-sm text-success">✓ Đã lưu</span>}
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
const NGUON_KHO: Record<string, string> = { linhkien: "linh-kien-app", tu_khai_bao: "Tự khai báo", import: "Từ file import" };

function Kho({ coTheGhi }: { coTheGhi: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cd-kho"], queryFn: () => api<{ rows: KhoRow[] }>("/cai-dat/kho") });
  const [loai, setLoai] = useState("");
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [loaiMoi, setLoaiMoi] = useState("cong_ty");
  const [dangDoi, setDangDoi] = useState("");
  const luu = useMutation({ mutationFn: ({ ma, ...b }: { ma: string } & Record<string, unknown>) => api(`/cai-dat/kho/${encodeURIComponent(ma)}`, { method: "PUT", json: b }), onSuccess: () => qc.invalidateQueries() });
  const tatCa = q.data?.rows ?? [];
  const rows = tatCa.filter((r) => !loai || r.loai === loai || (loai === "moi" && r.loai === "khac" && r.nguon === "import"));
  const doiHangLoat = async () => {
    const ds = [...chon];
    for (let i = 0; i < ds.length; i += 6) {
      setDangDoi(`Đang đổi ${Math.min(i + 6, ds.length)}/${ds.length}…`);
      await Promise.all(ds.slice(i, i + 6).map((ma) => api(`/cai-dat/kho/${encodeURIComponent(ma)}`, { method: "PUT", json: { loai: loaiMoi } })));
    }
    setDangDoi("");
    setChon(new Set());
    qc.invalidateQueries();
  };
  const cot: Cot<KhoRow>[] = [
    { ten: "Mã kho", lay: (r) => r.ma, cls: "font-mono text-xs", sx: (r) => r.ma },
    { ten: "Tên", lay: (r) => r.ten, sx: (r) => r.ten },
    {
      ten: "Loại",
      sx: (r) => r.loai,
      lay: (r) => (
        <select className="input" disabled={!coTheGhi} value={r.loai} onClick={(e) => e.stopPropagation()} onChange={(e) => luu.mutate({ ma: r.ma, loai: e.target.value })}>
          {LOAI_KHO.map((l) => (
            <option key={l.v} value={l.v}>
              {l.t}
            </option>
          ))}
        </select>
      ),
    },
    {
      ten: "Làm việc",
      lay: (r) =>
        r.loai !== "ktv" ? (
          ""
        ) : (
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
    { ten: "Nguồn", lay: (r) => <span className="text-xs text-ink-soft">{NGUON_KHO[r.nguon] ?? r.nguon}</span>, sx: (r) => r.nguon },
  ];
  if (q.isLoading) return <TaiDang />;
  const moi = tatCa.filter((r) => r.loai === "khac" && r.nguon === "import").length;
  return (
    <div>
      <div className="mb-3 grid gap-2 text-xs sm:grid-cols-4">
        {[
          ["Kho công ty / Khác", "Tính riêng từng kho trong Đắp chiếu, Leadtime."],
          ["Kho KTV", "Gộp thành “Kho KTV chung”; dùng cho báo cáo Thu hồi. Xuất của kho KTV không tính vào đắp chiếu."],
          ["Bỏ qua", "Loại khỏi mọi báo cáo (kho tạm, kho lỗi…)."],
          ["Ô trống", "Theo dữ liệu đồng bộ từ linh-kien-app (khi có API)."],
        ].map(([a, b]) => (
          <div key={a} className="card py-2">
            <b>{a}</b>: <span className="text-ink-soft">{b}</span>
          </div>
        ))}
      </div>
      {moi > 0 && (
        <div className="mb-3">
          <ThongBao loai="warning">
            {moi} kho mới gặp trong file import chưa chọn loại (đang tính “Khác”).{" "}
            <button className="underline" onClick={() => setLoai("moi")}>
              Xem danh sách
            </button>
          </ThongBao>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Chon nhan="Loại" giaTri={loai} dat={setLoai} luaChon={[{ v: "", t: `Tất cả (${tatCa.length})` }, ...LOAI_KHO.map((l) => ({ ...l, t: `${l.t} (${tatCa.filter((r) => r.loai === l.v).length})` })), { v: "moi", t: `Mới từ file, chưa phân loại (${moi})` }]} />
        <button className="btn ml-auto" onClick={() => taiExcel("danh-sach-kho.xlsx", ["Mã kho", "Tên", "Loại", "Làm việc", "Phòng ban", "Khu vực", "Tên khác", "Nguồn"], rows.map((r) => [r.ma, r.ten, LOAI_KHO.find((l) => l.v === r.loai)?.t ?? r.loai, (r.lam_viec_tay ?? r.lam_viec) == null ? null : (r.lam_viec_tay ?? r.lam_viec) ? "Làm" : "Nghỉ", r.phong_ban_tay ?? r.phong_ban, r.khu_vuc_tay ?? r.khu_vuc, r.ten_khac.join("; "), NGUON_KHO[r.nguon] ?? r.nguon]))}>
          <Icon ten="tai-xuong" /> Tải Excel
        </button>
      </div>
      {coTheGhi && chon.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary-soft px-3 py-2 text-sm">
          Đã chọn <b>{chon.size}</b> kho — đổi loại thành
          <select className="input" value={loaiMoi} onChange={(e) => setLoaiMoi(e.target.value)}>
            {LOAI_KHO.map((l) => (
              <option key={l.v} value={l.v}>
                {l.t}
              </option>
            ))}
          </select>
          <button className="btn-primary btn-sm" disabled={!!dangDoi} onClick={doiHangLoat}>
            {dangDoi || "Áp dụng"}
          </button>
          <button className="btn btn-sm" onClick={() => setChon(new Set())}>
            Bỏ chọn
          </button>
        </div>
      )}
      <Bang rows={rows} cot={cot} timTheo={(r) => `${r.ma} ${r.ten} ${r.ten_khac.join(" ")}`} chon={coTheGhi ? chon : undefined} datChon={setChon} khoa={(r) => r.ma} />
    </div>
  );
}

function ODieuChinh({ giaTri, dongBo, luu, coTheGhi }: { giaTri: string | null; dongBo: string | null; luu: (v: string | null) => void; coTheGhi: boolean }) {
  const [v, setV] = useState(giaTri ?? "");
  return <input className="input w-32" disabled={!coTheGhi} placeholder={dongBo ?? "Chưa khai báo"} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (giaTri ?? "") && luu(v.trim() || null)} />;
}

// ---------------------------------------------------------------- Tham so
const NHOM_THAM_SO: { t: string; moTa: string; ds: [string, string][] }[] = [
  {
    t: "Đắp chiếu & Cảnh báo T5",
    moTa: "SL dự trữ = ROUNDUP((TB 3 tháng + Xuất tháng N) / 2 × Hệ số).",
    ds: [
      ["he_so_du_tru_mac_dinh", "Hệ số dự trữ mặc định (LK chưa khai báo)"],
      ["so_thang_hien_thi", "Số tháng xuất hiển thị"],
      ["so_thang_chot_tinh", "Chốt tĩnh xuất tháng sau (tháng)"],
    ],
  },
  {
    t: "Cảnh báo leadtime",
    moTa: "Số ngày dư = Tồn / (Tiêu hao / số ngày) − số ngày cửa sổ − Leadtime.",
    ds: [
      ["cua_so_ngay", "Cửa sổ tiêu hao (ngày)"],
      ["leadtime_mac_dinh", "Leadtime mặc định (ngày)"],
      ["he_so_nk_mac_dinh", "Hệ số tồn chuẩn mặc định (LK chưa khai báo)"],
      ["nguong_thieu_nghiem_trong", "Thiếu nghiêm trọng khi số ngày dư <"],
      ["nguong_thieu", "Thiếu hàng khi số ngày dư <"],
      ["nguong_toi_diem_dat", "Tới thời điểm đặt khi số ngày dư ≤"],
      ["tan_suat_it", "Ít tiêu hao: tiêu hao 30 ngày ≤"],
      ["tan_suat_nhieu", "Tiêu nhiều: TH30 ≥ / TH14 ≥ / TH7 ≥"],
      ["tan_suat_deu", "Tiêu đều: TH30 ≥ / TH14 ≥ / TH7 ≥"],
    ],
  },
  {
    t: "LK thu hồi DVBH",
    moTa: "Tồn chuẩn = ROUNDUP(Xuất trong kỳ / số kỳ 2 tuần × Hệ số phân loại).",
    ds: [
      ["so_ky_2_tuan_mac_dinh", "Số kỳ 2 tuần khi file tồn không có kỳ"],
      ["phan_loai_chua_cai_dat", "Phân loại gán cho LK chưa khai báo"],
    ],
  },
];

function ThamSo({ coTheGhi }: { coTheGhi: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cd-tham-so"], queryFn: () => api<{ tham_so: Record<string, unknown>; mac_dinh: Record<string, unknown> }>("/cai-dat/tham-so") });
  const [ts, setTs] = useState<Record<string, unknown> | null>(null);
  useEffect(() => setTs(q.data?.tham_so ?? null), [q.data]);
  const luu = useMutation({ mutationFn: () => api("/cai-dat/tham-so", { method: "PUT", json: ts }), onSuccess: () => qc.invalidateQueries() });
  if (!ts) return <TaiDang />;
  const md = q.data!.mac_dinh;
  const khacMd = (k: string) => JSON.stringify(ts[k]) !== JSON.stringify(md[k]);
  return (
    <div className="max-w-4xl space-y-4">
      {NHOM_THAM_SO.map((g) => (
        <div key={g.t} className="card">
          <h2 className="card-title">{g.t}</h2>
          <p className="mb-2 text-xs text-ink-soft">{g.moTa}</p>
          {g.ds.map(([k, nhan]) => {
            const v = ts[k];
            return (
              <label key={k} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-2 text-sm">
                <span>
                  {nhan}
                  {khacMd(k) && (
                    <span className="ml-2 text-xs text-warning" title="Khác giá trị mặc định">
                      (mặc định {Array.isArray(md[k]) ? (md[k] as unknown[]).join(" / ") : String(md[k])})
                    </span>
                  )}
                </span>
                {Array.isArray(v) ? (
                  <span className="flex gap-1">
                    {v.map((x, i) => (
                      <input key={i} className="input w-20 text-right" type="number" disabled={!coTheGhi} value={x as number} onChange={(e) => setTs({ ...ts, [k]: v.map((y, j) => (j === i ? Number(e.target.value) : y)) })} />
                    ))}
                  </span>
                ) : (
                  <input className="input w-56 text-right" type={typeof v === "number" ? "number" : "text"} disabled={!coTheGhi} value={v as string | number} onChange={(e) => setTs({ ...ts, [k]: typeof v === "number" ? Number(e.target.value) : e.target.value })} />
                )}
              </label>
            );
          })}
        </div>
      ))}
      {coTheGhi && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={luu.isPending} onClick={() => luu.mutate()}>
            Lưu tham số
          </button>
          <button className="btn" onClick={() => confirm("Đưa mọi tham số về giá trị mặc định? (bấm Lưu để áp dụng)") && setTs({ ...md })}>
            Khôi phục mặc định
          </button>
          {luu.isSuccess && <span className="text-sm text-success">✓ Đã lưu — báo cáo tính lại theo tham số mới</span>}
          {luu.error && <Loi loi={luu.error} />}
        </div>
      )}
    </div>
  );
}
