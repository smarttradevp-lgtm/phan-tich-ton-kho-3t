import { useEffect, useMemo, useState, type ReactNode } from "react";
import { boDau } from "../lib/excel";

export function TieuDe({ ten, moTa, phai }: { ten: string; moTa?: ReactNode; phai?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight">{ten}</h1>
        {moTa && <div className="mt-1 text-sm text-ink-soft">{moTa}</div>}
      </div>
      {phai && <div className="flex flex-wrap items-center gap-2">{phai}</div>}
    </div>
  );
}

export function Chon<T extends string>({ nhan, giaTri, dat, luaChon }: { nhan: string; giaTri: T; dat: (v: T) => void; luaChon: { v: T; t: string }[] }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-ink-soft">
      {nhan}
      <select className="input max-w-[260px]" value={giaTri} onChange={(e) => dat(e.target.value as T)}>
        {luaChon.map((o) => (
          <option key={o.v} value={o.v}>
            {o.t}
          </option>
        ))}
      </select>
    </label>
  );
}

// Chon tu danh sach gia tri xuat hien trong du lieu ("" = tat ca).
export function ChonGiaTri({ nhan, giaTri, dat, ds }: { nhan: string; giaTri: string; dat: (v: string) => void; ds: string[] }) {
  return <Chon nhan={nhan} giaTri={giaTri} dat={dat} luaChon={[{ v: "", t: "Tất cả" }, ...ds.map((v) => ({ v, t: v }))]} />;
}

type Mau = "danger" | "warning" | "success";
const MAU_CHU: Record<Mau, string> = { danger: "text-danger", warning: "text-warning", success: "text-success" };

// The KPI: nhan + so lon + dong phu. onClick -> bam duoc (mo bao cao lien quan).
export function O({ nhan, so, phu, mau, icon, onClick }: { nhan: string; so: ReactNode; phu?: ReactNode; mau?: Mau; icon?: IconTen; onClick?: () => void }) {
  const noiDung = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-ink-soft">{nhan}</div>
        {icon && (
          <span className={`rounded-lg p-1.5 ${mau ? `${MAU_CHU[mau]} bg-subtle` : "bg-primary-soft text-primary"}`}>
            <Icon ten={icon} cls="h-4 w-4" />
          </span>
        )}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${mau ? MAU_CHU[mau] : "text-ink"}`}>{so}</div>
      {phu && <div className="mt-1 text-xs text-ink-soft">{phu}</div>}
    </>
  );
  return onClick ? (
    <button className="card text-left transition hover:border-primary hover:shadow-sm" onClick={onClick}>
      {noiDung}
    </button>
  ) : (
    <div className="card">{noiDung}</div>
  );
}

export function TaiDang({ chu = "Đang tải…" }: { chu?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-soft">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" />
      {chu}
    </div>
  );
}

export const MO_TA_LOI: Record<string, string> = {
  FORBIDDEN_ROLE: "Tài khoản không có quyền thao tác này.",
  PHIEN_DANG_DUNG: "Không xoá được phiên tồn kho đang dùng cho báo cáo.",
  DA_CO: "Tài khoản đã tồn tại.",
  EMAIL_KHONG_HOP_LE: "Email không hợp lệ.",
  KHONG_TU_SUA: "Không tự sửa / xoá tài khoản của chính mình.",
  TRUNG_TEN: "Có phân loại trùng tên.",
  FILE_RONG: "File không có dòng hợp lệ.",
  DONG_LOI: "File có dòng lỗi.",
  NGAY_KHONG_HOP_LE: "Ngày không hợp lệ.",
  INTERNAL_ERROR: "Lỗi hệ thống — thử lại sau.",
};

export function Loi({ loi }: { loi: unknown }) {
  const m = String((loi as Error)?.message ?? loi);
  return <ThongBao loai="danger">Lỗi: {MO_TA_LOI[m] ?? m}</ThongBao>;
}

export function ThongBao({ loai = "info", children }: { loai?: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  const c = {
    info: "border-blue-200 bg-primary-soft text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
    success: "border-green-200 bg-green-50 text-green-800",
  }[loai];
  return <div className={`rounded-lg border px-3 py-2 text-sm ${c}`}>{children}</div>;
}

export function Tabs<T extends string>({ ds, giaTri, dat }: { ds: { v: T; t: ReactNode }[]; giaTri: T; dat: (v: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {ds.map((t) => (
        <button key={t.v} className={`tab ${giaTri === t.v ? "active" : ""}`} onClick={() => dat(t.v)}>
          {t.t}
        </button>
      ))}
    </div>
  );
}

// Drawer ben phai (chi tiet). Esc / bam nen de dong.
export function Drawer({ mo, dong, tieuDe, phu, children, rong = "max-w-3xl" }: { mo: boolean; dong: () => void; tieuDe: ReactNode; phu?: ReactNode; children: ReactNode; rong?: string }) {
  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && dong();
    addEventListener("keydown", f);
    return () => removeEventListener("keydown", f);
  }, [mo, dong]);
  if (!mo) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={dong}>
      <div className={`flex h-full w-full ${rong} flex-col bg-white shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="text-lg font-bold">{tieuDe}</div>
            {phu && <div className="mt-0.5 text-sm text-ink-soft">{phu}</div>}
          </div>
          <button className="btn btn-sm" onClick={dong} aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ mo, dong, tieuDe, children, chan, rong = "max-w-lg" }: { mo: boolean; dong: () => void; tieuDe: ReactNode; children: ReactNode; chan?: ReactNode; rong?: string }) {
  if (!mo) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={dong}>
      <div className={`card w-full ${rong} shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-semibold">{tieuDe}</h3>
        {children}
        {chan && <div className="mt-4 flex justify-end gap-2">{chan}</div>}
      </div>
    </div>
  );
}

export interface Cot<R> {
  ten: string;
  lay: (r: R) => ReactNode;
  so?: boolean;
  cls?: string;
  sx?: (r: R) => number | string | null | undefined; // gia tri sap xep; khong co = cot khong sap xep duoc
}

// Bang phan trang phia trinh duyet + o tim (khop khong dau theo timTheo) + bam tieu de de sap xep.
export function Bang<R>({
  rows, cot, timTheo, kichThuoc = 50, dongTong, onClick, chon, datChon, khoa, congCu,
}: {
  rows: R[]; cot: Cot<R>[]; timTheo?: (r: R) => string; kichThuoc?: number; dongTong?: ReactNode; onClick?: (r: R) => void;
  chon?: Set<string>; datChon?: (s: Set<string>) => void; khoa?: (r: R) => string; congCu?: ReactNode;
}) {
  const [tim, setTim] = useState("");
  const [trang, setTrang] = useState(0);
  const [co, setCo] = useState(kichThuoc);
  const [sx, setSx] = useState<{ i: number; tang: boolean } | null>(null);
  const loc = useMemo(() => {
    const q = boDau(tim);
    let r = q && timTheo ? rows.filter((x) => boDau(timTheo(x)).includes(q)) : rows;
    const f = sx ? cot[sx.i]?.sx : undefined;
    if (sx && f) {
      r = [...r].sort((a, b) => {
        const x = f(a), y = f(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "vi");
        return sx.tang ? d : -d;
      });
    }
    return r;
  }, [rows, tim, timTheo, sx, cot]);
  useEffect(() => setTrang(0), [rows]);
  const soTrang = Math.max(1, Math.ceil(loc.length / co));
  const t = Math.min(trang, soTrang - 1);
  const hien = loc.slice(t * co, (t + 1) * co);
  const coChon = !!(chon && datChon && khoa);
  const tatCaDaChon = coChon && loc.length > 0 && loc.every((r) => chon!.has(khoa!(r)));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {timTheo && (
          <div className="relative">
            <Icon ten="tim" cls="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-ink-soft" />
            <input className="input w-72 pl-8" placeholder="Tìm mã / tên…" value={tim} onChange={(e) => (setTim(e.target.value), setTrang(0))} />
          </div>
        )}
        <span className="text-sm text-ink-soft">{loc.length.toLocaleString("vi-VN")} dòng</span>
        {congCu}
        <div className="ml-auto flex items-center gap-1 text-sm">
          <select className="input py-1 text-xs" value={co} onChange={(e) => (setCo(Number(e.target.value)), setTrang(0))}>
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n} / trang
              </option>
            ))}
          </select>
          <button className="btn btn-sm" disabled={t === 0} onClick={() => setTrang(t - 1)} aria-label="Trang trước">
            ‹
          </button>
          <span className="px-1 tabular-nums">
            {t + 1}/{soTrang}
          </span>
          <button className="btn btn-sm" disabled={t >= soTrang - 1} onClick={() => setTrang(t + 1)} aria-label="Trang sau">
            ›
          </button>
        </div>
      </div>
      <div className="max-h-[68vh] overflow-auto rounded-xl border border-line">
        <table className="tbl">
          <thead>
            <tr>
              {coChon && (
                <th className="w-8">
                  <input
                    type="checkbox"
                    checked={tatCaDaChon}
                    onChange={() => {
                      const s = new Set(chon);
                      for (const r of loc) tatCaDaChon ? s.delete(khoa!(r)) : s.add(khoa!(r));
                      datChon!(s);
                    }}
                    title="Chọn tất cả dòng đang lọc"
                  />
                </th>
              )}
              {cot.map((c, i) => (
                <th
                  key={c.ten + i}
                  className={`${c.so ? "so" : ""} ${c.sx ? "cursor-pointer select-none hover:text-ink" : ""}`}
                  onClick={c.sx ? () => setSx(sx?.i === i ? (sx.tang ? { i, tang: false } : null) : { i, tang: !c.so }) : undefined}
                >
                  {c.ten}
                  {sx?.i === i && <span className="ml-0.5 text-primary">{sx.tang ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dongTong}
            {hien.map((r, i) => {
              const k = khoa?.(r);
              return (
                <tr key={k ?? i} className={`${onClick ? "cursor-pointer" : ""} hover:bg-subtle ${k && chon?.has(k) ? "bg-primary-soft/60" : ""}`} onClick={onClick ? () => onClick(r) : undefined}>
                  {coChon && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={chon!.has(k!)}
                        onChange={() => {
                          const s = new Set(chon);
                          s.has(k!) ? s.delete(k!) : s.add(k!);
                          datChon!(s);
                        }}
                      />
                    </td>
                  )}
                  {cot.map((c, j) => (
                    <td key={c.ten + j} className={`${c.so ? "so" : ""} ${c.cls ?? ""}`}>
                      {c.lay(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!hien.length && (
              <tr>
                <td colSpan={cot.length + (coChon ? 1 : 0)} className="py-10 text-center text-ink-soft">
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const MAU_XEP_LOAI: Record<string, string> = {
  T5: "bg-red-100 text-red-700",
  T1: "bg-slate-100 text-slate-700",
  T2: "bg-green-100 text-green-700",
  T3: "bg-amber-100 text-amber-700",
  T4: "bg-orange-100 text-orange-700",
};

export const MO_TA_XEP_LOAI: Record<string, string> = {
  T1: "Tồn dư = 0",
  T2: "Tồn dư > 0, tới 50% SL dự trữ",
  T3: "Tồn dư > 0, 50–100% SL dự trữ",
  T4: "Tồn dư > 100% SL dự trữ",
  T5: "Tồn dư < 0 (nguy cơ thiếu hàng)",
};

export function NhanXepLoai({ v }: { v: string }) {
  return (
    <span className={`badge ${MAU_XEP_LOAI[v] ?? "bg-slate-100"}`} title={MO_TA_XEP_LOAI[v]}>
      {v === "T5" && "⚠ "}
      {v}
    </span>
  );
}

export function NhanCanhBao({ v }: { v: string }) {
  const c = v.startsWith("1.") ? "bg-red-100 text-red-700" : v.startsWith("2.") ? "bg-orange-100 text-orange-700" : v.startsWith("3.") ? "bg-amber-100 text-amber-700" : v.startsWith("4.") ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600";
  return <span className={`badge ${c}`}>{v}</span>;
}

export const duyNhat = (ds: (string | null | undefined)[]) => [...new Set(ds.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "vi"));

// ---------------------------------------------------------------- Icon (net 1.75px, theo currentColor)
export type IconTen =
  | "tong-quan" | "dap-chieu" | "canh-bao" | "dong-ho" | "thu-hoi" | "tai-len" | "tai-xuong" | "cai-dat" | "nguoi" | "du-lieu" | "nhat-ky"
  | "tim" | "menu" | "dang-xuat" | "kho" | "tien" | "hop" | "lop" | "the";

const DUONG: Record<IconTen, string> = {
  "tong-quan": "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  "dap-chieu": "M21 8v13H3V8M1 3h22v5H1zM10 12h4",
  "canh-bao": "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  "dong-ho": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  "thu-hoi": "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  "tai-len": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  "tai-xuong": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  "cai-dat": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  nguoi: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  "du-lieu": "M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3zM21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5",
  "nhat-ky": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  tim: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  menu: "M3 12h18M3 6h18M3 18h18",
  "dang-xuat": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  kho: "M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21V12h6v9",
  tien: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  hop: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7 12 12l8.7-5M12 22V12",
  lop: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  the: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
};

export function Icon({ ten, cls = "h-4 w-4" }: { ten: IconTen; cls?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
      <path d={DUONG[ten]} />
    </svg>
  );
}
