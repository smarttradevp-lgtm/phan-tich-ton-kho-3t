import { useMemo, useState, type ReactNode } from "react";
import { boDau } from "../lib/excel";

export function TieuDe({ ten, moTa, phai }: { ten: string; moTa?: ReactNode; phai?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{ten}</h1>
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
      <select className="input" value={giaTri} onChange={(e) => dat(e.target.value as T)}>
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

export function O({ nhan, so, phu, mau }: { nhan: string; so: ReactNode; phu?: ReactNode; mau?: "danger" | "warning" | "success" }) {
  const c = mau === "danger" ? "text-danger" : mau === "warning" ? "text-warning" : mau === "success" ? "text-success" : "text-ink";
  return (
    <div className="card">
      <div className="text-xs font-medium text-ink-soft">{nhan}</div>
      <div className={`mt-1 text-2xl font-bold ${c}`}>{so}</div>
      {phu && <div className="mt-1 text-xs text-ink-soft">{phu}</div>}
    </div>
  );
}

export function TaiDang() {
  return <div className="py-10 text-center text-sm text-ink-soft">Đang tải…</div>;
}

export function Loi({ loi }: { loi: unknown }) {
  return <div className="rounded-lg border border-danger/30 bg-red-50 p-3 text-sm text-danger">Lỗi: {String((loi as Error)?.message ?? loi)}</div>;
}

export interface Cot<R> {
  ten: string;
  lay: (r: R) => ReactNode;
  so?: boolean;
  cls?: string;
}

// Bang phan trang phia trinh duyet + o tim (khop khong dau theo cac truong timTheo).
export function Bang<R>({ rows, cot, timTheo, kichThuoc = 100, dongTong, onClick }: { rows: R[]; cot: Cot<R>[]; timTheo?: (r: R) => string; kichThuoc?: number; dongTong?: ReactNode; onClick?: (r: R) => void }) {
  const [tim, setTim] = useState("");
  const [trang, setTrang] = useState(0);
  const loc = useMemo(() => {
    const q = boDau(tim);
    return q && timTheo ? rows.filter((r) => boDau(timTheo(r)).includes(q)) : rows;
  }, [rows, tim, timTheo]);
  const soTrang = Math.max(1, Math.ceil(loc.length / kichThuoc));
  const t = Math.min(trang, soTrang - 1);
  const hien = loc.slice(t * kichThuoc, (t + 1) * kichThuoc);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {timTheo && <input className="input w-72" placeholder="Tìm mã / tên…" value={tim} onChange={(e) => (setTim(e.target.value), setTrang(0))} />}
        <span className="text-sm text-ink-soft">{loc.length.toLocaleString("vi-VN")} dòng</span>
        <div className="ml-auto flex items-center gap-1 text-sm">
          <button className="btn" disabled={t === 0} onClick={() => setTrang(t - 1)}>
            ‹
          </button>
          <span className="px-2">
            {t + 1}/{soTrang}
          </span>
          <button className="btn" disabled={t >= soTrang - 1} onClick={() => setTrang(t + 1)}>
            ›
          </button>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-line">
        <table className="tbl">
          <thead>
            <tr>
              {cot.map((c) => (
                <th key={c.ten} className={c.so ? "so" : ""}>
                  {c.ten}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dongTong}
            {hien.map((r, i) => (
              <tr key={i} className={onClick ? "cursor-pointer hover:bg-subtle" : "hover:bg-subtle"} onClick={onClick ? () => onClick(r) : undefined}>
                {cot.map((c) => (
                  <td key={c.ten} className={`${c.so ? "so" : ""} ${c.cls ?? ""}`}>
                    {c.lay(r)}
                  </td>
                ))}
              </tr>
            ))}
            {!hien.length && (
              <tr>
                <td colSpan={cot.length} className="py-8 text-center text-ink-soft">
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

export function NhanXepLoai({ v }: { v: string }) {
  return <span className={`badge ${MAU_XEP_LOAI[v] ?? "bg-slate-100"}`}>{v}</span>;
}

export function NhanCanhBao({ v }: { v: string }) {
  const c = v.startsWith("1.") ? "bg-red-100 text-red-700" : v.startsWith("2.") ? "bg-orange-100 text-orange-700" : v.startsWith("3.") ? "bg-amber-100 text-amber-700" : v.startsWith("4.") ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600";
  return <span className={`badge ${c}`}>{v}</span>;
}

export const duyNhat = (ds: (string | null | undefined)[]) => [...new Set(ds.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "vi"));
