import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUrlState } from "../lib/dieuHuong";

// Man hinh hep (< 768px = duoi breakpoint md cua Tailwind) -> bang chuyen sang dang the, modal thanh bottom sheet.
const MQ = "(max-width: 767px)";
export function useMobile(): boolean {
  const [m, setM] = useState(() => typeof matchMedia !== "undefined" && matchMedia(MQ).matches);
  useEffect(() => {
    const q = matchMedia(MQ);
    const f = () => setM(q.matches);
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return m;
}
import { boDau } from "../lib/excel";

export function TieuDe({ ten, moTa, phai }: { ten: string; moTa?: ReactNode; phai?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-tight md:text-xl">{ten}</h1>
        {moTa && <div className="mt-1 text-xs text-ink-soft md:text-sm">{moTa}</div>}
      </div>
      {phai && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{phai}</div>}
    </div>
  );
}

export function Chon<T extends string>({ nhan, giaTri, dat, luaChon }: { nhan: string; giaTri: T; dat: (v: T) => void; luaChon: { v: T; t: string }[] }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5 text-xs text-ink-soft sm:flex-row sm:items-center sm:gap-1.5 sm:text-sm">
      {nhan}
      <select className="input w-full min-w-0 sm:w-auto sm:max-w-[260px]" value={giaTri} onChange={(e) => dat(e.target.value as T)}>
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
      <div className={`mt-1 text-xl font-bold tabular-nums md:text-2xl ${mau ? MAU_CHU[mau] : "text-ink"}`}>{so}</div>
      {phu && <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-soft md:text-xs">{phu}</div>}
    </>
  );
  return onClick ? (
    <button className="card p-3 text-left transition hover:border-primary hover:shadow-sm md:p-4" onClick={onClick}>
      {noiDung}
    </button>
  ) : (
    <div className="card p-3 md:p-4">{noiDung}</div>
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
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 md:px-5 md:py-4">
          <div className="min-w-0">
            <div className="text-lg font-bold">{tieuDe}</div>
            {phu && <div className="mt-0.5 text-sm text-ink-soft">{phu}</div>}
          </div>
          <button className="btn btn-sm" onClick={dong} aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ mo, dong, tieuDe, children, chan, rong = "max-w-lg" }: { mo: boolean; dong: () => void; tieuDe: ReactNode; children: ReactNode; chan?: ReactNode; rong?: string }) {
  if (!mo) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 md:items-center md:p-4" onClick={dong}>
      <div
        className={`flex max-h-[90dvh] w-full ${rong} flex-col rounded-t-2xl border border-line bg-white shadow-xl md:rounded-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" />
        <h3 className="px-4 pb-2 pt-3 text-base font-semibold md:px-5 md:pt-4">{tieuDe}</h3>
        <div className="flex-1 overflow-y-auto px-4 md:px-5">{children}</div>
        {chan && <div className="flex justify-end gap-2 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:mt-2 md:px-5 [&>*]:flex-1 md:[&>*]:flex-none">{chan}</div>}
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
  // Hien thi o dang the (mobile): tieu_de = dong dau dam, phu = dong phu, nhan = goc phai (badge), an = an; mac dinh = luoi nhan/gia tri.
  the?: "tieu_de" | "phu" | "nhan" | "an";
  // Loc kieu Excel: "gt" = chon nhieu gia tri (theo gt() hoac sx()), "so" = khoang so (theo sx()).
  loc?: "gt" | "so";
  gt?: (r: R) => string | null | undefined;
}

// Gia tri o khi xuat Excel: gt() / sx() (cot khong co ca 2 -> null).
export function giaTriXuat<R>(c: Cot<R>, r: R): string | number | null {
  const v = c.gt ? c.gt(r) : c.sx?.(r);
  return v === undefined ? null : v;
}
export const cotXuat = <R,>(cot: Cot<R>[]) => cot.filter((c) => c.ten && (c.gt || c.sx));

// Trang thai loc 1 cot: v = danh sach gia tri duoc chon (gt), tu/den = khoang (so). Key = Cot.ten.
export interface LocCot { v?: string[]; tu?: number | null; den?: number | null }
const TRONG = "(Trống)";

function giaTriGt<R>(c: Cot<R>, r: R): string {
  const v = c.gt ? c.gt(r) : c.sx?.(r);
  return v == null || v === "" ? TRONG : String(v);
}
function soCua<R>(c: Cot<R>, r: R): number | null {
  const v = c.sx?.(r);
  const n = typeof v === "number" ? v : v == null || v === "" ? null : Number(v);
  return n == null || !Number.isFinite(n) ? null : n;
}
function khopLoc<R>(c: Cot<R>, f: LocCot, r: R): boolean {
  if (f.v) return f.v.includes(giaTriGt(c, r));
  const n = soCua(c, r);
  if (f.tu != null && (n == null || n < f.tu)) return false;
  if (f.den != null && (n == null || n > f.den)) return false;
  return true;
}
const coHieuLuc = (f?: LocCot) => !!f && (!!f.v || f.tu != null || f.den != null);
function moTaLoc(f: LocCot): string {
  if (f.v) return f.v.length <= 2 ? f.v.join(", ") : `${f.v.length} giá trị`;
  const so = (n: number) => n.toLocaleString("vi-VN");
  if (f.tu != null && f.den != null) return f.tu === f.den ? `= ${so(f.tu)}` : `${so(f.tu)} → ${so(f.den)}`;
  return f.tu != null ? `≥ ${so(f.tu)}` : `≤ ${so(f.den!)}`;
}

// Bang phan trang phia trinh duyet + o tim (khop khong dau theo timTheo) + sap xep + loc tung cot kieu Excel.
// idUrl: luu tim / sap xep / loc cot len URL (gui link giu nguyen cach xem). onLoc: bao danh sach sau loc (tong, xuat Excel).
// Mobile: moi dong thanh 1 the (bo tri theo Cot.the); sap xep + loc cot gom vao nut "Bộ lọc".
export function Bang<R>({
  rows, cot, timTheo, kichThuoc = 50, dongTong, tongThe, onClick, chon, datChon, khoa, congCu, idUrl, onLoc,
}: {
  rows: R[]; cot: Cot<R>[]; timTheo?: (r: R) => string; kichThuoc?: number;
  dongTong?: ReactNode | ((loc: R[]) => ReactNode); tongThe?: ReactNode | ((loc: R[]) => ReactNode); onClick?: (r: R) => void;
  chon?: Set<string>; datChon?: (s: Set<string>) => void; khoa?: (r: R) => string; congCu?: ReactNode; idUrl?: string; onLoc?: (loc: R[]) => void;
}) {
  const mobile = useMobile();
  const [tim, setTim] = useUrlState(idUrl ? `${idUrl}.q` : null, "");
  const [trang, setTrang] = useState(0);
  const [co, setCo] = useState(kichThuoc);
  const [sx, setSx] = useUrlState<{ c: string; t: boolean } | null>(idUrl ? `${idUrl}.sx` : null, null);
  const [locCot, setLocCot] = useUrlState<Record<string, LocCot>>(idUrl ? `${idUrl}.loc` : null, {});
  const [moLoc, setMoLoc] = useState<{ ten: string; x: number; y: number } | null>(null);
  const [moBoLoc, setMoBoLoc] = useState(false);
  const cotTheoTen = useMemo(() => new Map(cot.map((c) => [c.ten, c])), [cot]);
  const locHieuLuc = useMemo(() => Object.entries(locCot).filter(([k, f]) => coHieuLuc(f) && cotTheoTen.get(k)?.loc), [locCot, cotTheoTen]);

  // Loc theo tim + moi cot, tru cot "boQua" (dem gia tri cho o loc cua chinh cot do, kieu Excel).
  const locTru = useCallback(
    (boQua?: string) => {
      const q = boDau(tim);
      return rows.filter(
        (r) => (!q || !timTheo || boDau(timTheo(r)).includes(q)) && locHieuLuc.every(([k, f]) => k === boQua || khopLoc(cotTheoTen.get(k)!, f, r)),
      );
    },
    [rows, tim, timTheo, locHieuLuc, cotTheoTen],
  );
  const loc = useMemo(() => {
    let r = locTru();
    const c = sx ? cotTheoTen.get(sx.c) : undefined;
    const f = c?.sx;
    if (sx && f) {
      r = [...r].sort((a, b) => {
        const x = f(a), y = f(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "vi");
        return sx.t ? d : -d;
      });
    }
    return r;
  }, [locTru, sx, cotTheoTen]);
  useEffect(() => onLoc?.(loc), [loc, onLoc]);
  useEffect(() => setTrang(0), [rows, locCot, tim]);
  const datLoc = (ten: string, f: LocCot | null) => {
    const m = { ...locCot };
    if (f && coHieuLuc(f)) m[ten] = f;
    else delete m[ten];
    setLocCot(m);
  };
  const coTrang = mobile ? Math.min(co, 25) : co;
  const soTrang = Math.max(1, Math.ceil(loc.length / coTrang));
  const t = Math.min(trang, soTrang - 1);
  const hien = loc.slice(t * coTrang, (t + 1) * coTrang);
  const coChon = !!(chon && datChon && khoa);
  const tatCaDaChon = coChon && loc.length > 0 && loc.every((r) => chon!.has(khoa!(r)));
  const doiChon = (k: string) => {
    const s = new Set(chon);
    s.has(k) ? s.delete(k) : s.add(k);
    datChon!(s);
  };
  const chonTatCa = () => {
    const s = new Set(chon);
    for (const r of loc) tatCaDaChon ? s.delete(khoa!(r)) : s.add(khoa!(r));
    datChon!(s);
  };
  const phanTrang = (
    <div className="flex items-center gap-1 text-sm">
      {!mobile && (
        <select className="input py-1 text-xs" value={co} onChange={(e) => (setCo(Number(e.target.value)), setTrang(0))}>
          {[25, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n} / trang
            </option>
          ))}
        </select>
      )}
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
  );
  const cotSx = cot.filter((c) => c.sx && c.ten);
  const cotLoc = cot.filter((c) => c.loc && c.ten);
  const veTong = (x: ReactNode | ((l: R[]) => ReactNode)) => (typeof x === "function" ? (x as (l: R[]) => ReactNode)(loc) : x);
  const cotDangMo = moLoc ? cotTheoTen.get(moLoc.ten) : undefined;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {timTheo && (
          <div className="relative w-full sm:w-auto">
            <Icon ten="tim" cls="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-ink-soft" />
            <input className="input w-full pl-8 sm:w-72" placeholder="Tìm mã / tên…" value={tim} onChange={(e) => (setTim(e.target.value), setTrang(0))} />
          </div>
        )}
        <span className="text-sm text-ink-soft">
          {loc.length.toLocaleString("vi-VN")}
          {loc.length !== rows.length && ` / ${rows.length.toLocaleString("vi-VN")}`} dòng
        </span>
        {congCu}
        {mobile && (cotLoc.length > 0 || cotSx.length > 0) && (
          <button className={`btn btn-sm ml-auto ${locHieuLuc.length || sx ? "border-primary text-primary" : ""}`} onClick={() => setMoBoLoc(true)}>
            <Icon ten="loc" /> Bộ lọc{locHieuLuc.length ? ` (${locHieuLuc.length})` : ""}
          </button>
        )}
        {!mobile && <div className="ml-auto">{phanTrang}</div>}
      </div>
      {locHieuLuc.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {locHieuLuc.map(([k, f]) => (
            <span key={k} className="chip border-primary/40 bg-primary-soft text-primary">
              <b className="font-semibold">{k}:</b> {moTaLoc(f)}
              <button className="ml-0.5 hover:text-danger" onClick={() => datLoc(k, null)} aria-label={`Bỏ lọc ${k}`}>
                ✕
              </button>
            </span>
          ))}
          <button className="text-xs text-ink-soft underline hover:text-ink" onClick={() => setLocCot({})}>
            Xoá lọc cột
          </button>
        </div>
      )}
      {mobile ? (
        <div className="space-y-2">
          {coChon && loc.length > 0 && (
            <label className="flex items-center gap-2 px-1 text-xs text-ink-soft">
              <input type="checkbox" checked={tatCaDaChon} onChange={chonTatCa} /> Chọn tất cả {loc.length.toLocaleString("vi-VN")} dòng đang lọc
            </label>
          )}
          {veTong(tongThe)}
          {hien.map((r, i) => (
            <TheDong key={khoa?.(r) ?? i} r={r} cot={cot} onClick={onClick} chon={coChon ? chon!.has(khoa!(r)) : undefined} doiChon={coChon ? () => doiChon(khoa!(r)) : undefined} />
          ))}
          {!hien.length && <div className="card py-8 text-center text-sm text-ink-soft">Không có dữ liệu</div>}
          {soTrang > 1 && <div className="flex justify-center pt-1">{phanTrang}</div>}
        </div>
      ) : (
        <div className="max-h-[68vh] overflow-auto rounded-xl border border-line">
          <table className="tbl">
            <thead>
              <tr>
                {coChon && (
                  <th className="w-8">
                    <input type="checkbox" checked={tatCaDaChon} onChange={chonTatCa} title="Chọn tất cả dòng đang lọc" />
                  </th>
                )}
                {cot.map((c, i) => (
                  <th key={c.ten + i} className={c.so ? "so" : ""}>
                    <span className={`inline-flex items-center gap-0.5 ${c.so ? "flex-row-reverse" : ""}`}>
                      <span
                        className={c.sx ? "cursor-pointer select-none hover:text-ink" : ""}
                        onClick={c.sx ? () => setSx(sx?.c === c.ten ? (sx.t === !c.so ? { c: c.ten, t: !sx.t } : null) : { c: c.ten, t: !c.so }) : undefined}
                      >
                        {c.ten}
                        {sx?.c === c.ten && <span className="ml-0.5 text-primary">{sx.t ? "▲" : "▼"}</span>}
                      </span>
                      {c.loc && (
                        <button
                          className={`rounded p-0.5 hover:bg-white ${coHieuLuc(locCot[c.ten]) ? "bg-primary text-white hover:bg-primary" : "text-ink-soft/70"}`}
                          title={`Lọc ${c.ten}`}
                          onClick={(e) => {
                            const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setMoLoc(moLoc?.ten === c.ten ? null : { ten: c.ten, x: b.left, y: b.bottom + 4 });
                          }}
                        >
                          <Icon ten="loc" cls="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {veTong(dongTong)}
              {hien.map((r, i) => {
                const k = khoa?.(r);
                return (
                  <tr key={k ?? i} className={`${onClick ? "cursor-pointer" : ""} hover:bg-subtle ${k && chon?.has(k) ? "bg-primary-soft/60" : ""}`} onClick={onClick ? () => onClick(r) : undefined}>
                    {coChon && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={chon!.has(k!)} onChange={() => doiChon(k!)} />
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
      )}
      {moLoc && cotDangMo && !mobile && (
        <PopoverLoc x={moLoc.x} y={moLoc.y} dong={() => setMoLoc(null)}>
          <PanelLoc c={cotDangMo} rows={locTru(cotDangMo.ten)} giaTri={locCot[cotDangMo.ten]} dat={(f) => (datLoc(cotDangMo.ten, f), setMoLoc(null))} />
        </PopoverLoc>
      )}
      {mobile && (
        <BoLocMobile
          mo={moBoLoc}
          dong={() => setMoBoLoc(false)}
          cotLoc={cotLoc}
          cotSx={cotSx}
          sx={sx}
          datSx={setSx}
          locCot={locCot}
          datLoc={datLoc}
          xoaHet={() => (setLocCot({}), setSx(null))}
          rowsTru={locTru}
        />
      )}
    </div>
  );
}

// Popover co dinh theo vi tri nut (bang co overflow nen khong dat absolute ben trong). Bam ngoai / Esc = dong.
function PopoverLoc({ x, y, dong, children }: { x: number; y: number; dong: () => void; children: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && dong();
    addEventListener("keydown", f);
    return () => removeEventListener("keydown", f);
  }, [dong]);
  const left = Math.max(8, Math.min(x, innerWidth - 300));
  const top = Math.min(y, innerHeight - 420);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={dong} />
      <div className="fixed z-50 w-[288px] rounded-xl border border-line bg-white p-3 text-sm shadow-xl" style={{ left, top: Math.max(8, top) }}>
        {children}
      </div>
    </>
  );
}

// Noi dung loc 1 cot: "gt" = danh sach gia tri + so dong (tinh tren du lieu da loc boi cot khac), "so" = khoang.
function PanelLoc<R>({ c, rows, giaTri, dat }: { c: Cot<R>; rows: R[]; giaTri?: LocCot; dat: (f: LocCot | null) => void }) {
  const ds = useMemo(() => {
    if (c.loc !== "gt") return [];
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = giaTriGt(c, r);
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    // Gia tri da chon nhung khong con trong du lieu (do cot khac loc) van hien de bo chon duoc.
    for (const v of giaTri?.v ?? []) if (!m.has(v)) m.set(v, 0);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi", { numeric: true }));
  }, [c, rows, giaTri]);
  const [nhap, setNhap] = useState<Set<string>>(() => new Set(giaTri?.v ?? ds.map(([v]) => v)));
  const [tim, setTim] = useState("");
  const [tu, setTu] = useState(giaTri?.tu != null ? String(giaTri.tu) : "");
  const [den, setDen] = useState(giaTri?.den != null ? String(giaTri.den) : "");
  if (c.loc === "so") {
    const so = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));
    return (
      <div className="space-y-2">
        <div className="font-semibold">Lọc {c.ten}</div>
        <div className="flex flex-wrap gap-1">
          {[
            ["< 0", null, -1e-9],
            ["= 0", 0, 0],
            ["> 0", 1e-9, null],
          ].map(([t, a, b]) => (
            <button key={t as string} className="btn btn-sm" onClick={() => dat({ tu: a as number | null, den: b as number | null })}>
              {t}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-soft">
            Từ
            <input className="input mt-0.5 w-full" type="number" value={tu} onChange={(e) => setTu(e.target.value)} placeholder="không giới hạn" />
          </label>
          <label className="text-xs text-ink-soft">
            Đến
            <input className="input mt-0.5 w-full" type="number" value={den} onChange={(e) => setDen(e.target.value)} placeholder="không giới hạn" />
          </label>
        </div>
        <div className="flex justify-between gap-2 pt-1">
          <button className="btn btn-sm" onClick={() => dat(null)}>
            Bỏ lọc
          </button>
          <button className="btn-primary btn-sm" onClick={() => dat({ tu: so(tu), den: so(den) })}>
            Áp dụng
          </button>
        </div>
      </div>
    );
  }
  const q = boDau(tim);
  const hien = q ? ds.filter(([v]) => boDau(v).includes(q)) : ds;
  const tatCaHien = hien.length > 0 && hien.every(([v]) => nhap.has(v));
  const apDung = () => {
    const tatCa = ds.every(([v]) => nhap.has(v));
    dat(tatCa ? null : { v: [...nhap] });
  };
  return (
    <div className="space-y-2">
      <div className="font-semibold">Lọc {c.ten}</div>
      <input className="input w-full" placeholder="Tìm giá trị…" value={tim} onChange={(e) => setTim(e.target.value)} autoFocus />
      <label className="flex items-center gap-2 border-b border-line pb-1.5 text-xs font-medium">
        <input
          type="checkbox"
          checked={tatCaHien}
          onChange={() => {
            const s = new Set(nhap);
            for (const [v] of hien) tatCaHien ? s.delete(v) : s.add(v);
            setNhap(s);
          }}
        />
        {q ? `Chọn ${hien.length} giá trị khớp` : "Chọn tất cả"}
      </label>
      <div className="max-h-60 space-y-0.5 overflow-y-auto">
        {hien.slice(0, 500).map(([v, n]) => (
          <label key={v} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-subtle">
            <input
              type="checkbox"
              checked={nhap.has(v)}
              onChange={() => {
                const s = new Set(nhap);
                s.has(v) ? s.delete(v) : s.add(v);
                setNhap(s);
              }}
            />
            <span className={`min-w-0 flex-1 truncate ${v === TRONG ? "italic text-ink-soft" : ""}`} title={v}>
              {v}
            </span>
            <span className="text-xs tabular-nums text-ink-soft">{n.toLocaleString("vi-VN")}</span>
          </label>
        ))}
        {hien.length > 500 && <div className="px-1 text-xs text-ink-soft">… còn {hien.length - 500} giá trị, gõ để tìm</div>}
      </div>
      <div className="flex justify-between gap-2 pt-1">
        <button className="btn btn-sm" onClick={() => dat(null)}>
          Bỏ lọc
        </button>
        <button className="btn-primary btn-sm" disabled={!nhap.size} onClick={apDung}>
          Áp dụng
        </button>
      </div>
    </div>
  );
}

// Mobile: 1 bottom sheet gom sap xep + danh sach cot loc; bam 1 cot -> mo PanelLoc cua cot do.
function BoLocMobile<R>({
  mo, dong, cotLoc, cotSx, sx, datSx, locCot, datLoc, xoaHet, rowsTru,
}: {
  mo: boolean; dong: () => void; cotLoc: Cot<R>[]; cotSx: Cot<R>[]; sx: { c: string; t: boolean } | null; datSx: (v: { c: string; t: boolean } | null) => void;
  locCot: Record<string, LocCot>; datLoc: (ten: string, f: LocCot | null) => void; xoaHet: () => void; rowsTru: (boQua?: string) => R[];
}) {
  const [cotMo, setCotMo] = useState<string | null>(null);
  const c = cotLoc.find((x) => x.ten === cotMo);
  return (
    <Modal
      mo={mo}
      dong={() => (setCotMo(null), dong())}
      tieuDe={c ? `Lọc ${c.ten}` : "Bộ lọc & sắp xếp"}
      chan={
        c ? (
          <button className="btn" onClick={() => setCotMo(null)}>
            ‹ Quay lại
          </button>
        ) : (
          <>
            <button className="btn" onClick={xoaHet}>
              Xoá tất cả
            </button>
            <button className="btn-primary" onClick={dong}>
              Xong
            </button>
          </>
        )
      }
    >
      {c ? (
        <PanelLoc key={c.ten} c={c} rows={rowsTru(c.ten)} giaTri={locCot[c.ten]} dat={(f) => (datLoc(c.ten, f), setCotMo(null))} />
      ) : (
        <div className="space-y-3 pb-2">
          {cotSx.length > 0 && (
            <label className="block text-xs text-ink-soft">
              Sắp xếp
              <select
                className="input mt-0.5 w-full"
                value={sx ? `${sx.c}|${sx.t ? 1 : 0}` : ""}
                onChange={(e) => {
                  if (!e.target.value) return datSx(null);
                  const [ten, t] = e.target.value.split("|");
                  datSx({ c: ten, t: t === "1" });
                }}
              >
                <option value="">Mặc định</option>
                {cotSx.flatMap((x) => [
                  <option key={`${x.ten}d`} value={`${x.ten}|0`}>
                    {x.ten} — giảm dần
                  </option>,
                  <option key={`${x.ten}t`} value={`${x.ten}|1`}>
                    {x.ten} — tăng dần
                  </option>,
                ])}
              </select>
            </label>
          )}
          {cotLoc.length > 0 && (
            <div>
              <div className="mb-1 text-xs text-ink-soft">Lọc theo cột</div>
              <div className="divide-y divide-line rounded-lg border border-line">
                {cotLoc.map((x) => {
                  const f = locCot[x.ten];
                  return (
                    <button key={x.ten} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm" onClick={() => setCotMo(x.ten)}>
                      <span>{x.ten}</span>
                      <span className={`min-w-0 truncate text-xs ${coHieuLuc(f) ? "font-semibold text-primary" : "text-ink-soft"}`}>{coHieuLuc(f) ? moTaLoc(f!) : "Tất cả"} ›</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// 1 dong dang the (mobile). Cot khong co ten (nut thao tac) dat o cuoi the.
function TheDong<R>({ r, cot, onClick, chon, doiChon }: { r: R; cot: Cot<R>[]; onClick?: (r: R) => void; chon?: boolean; doiChon?: () => void }) {
  const tieuDe = cot.filter((c) => c.the === "tieu_de");
  const phu = cot.filter((c) => c.the === "phu");
  const nhan = cot.filter((c) => c.the === "nhan");
  const kv = cot.filter((c) => !c.the && c.ten);
  const thaoTac = cot.filter((c) => !c.the && !c.ten);
  return (
    <div className={`card p-3 ${onClick ? "cursor-pointer active:bg-subtle" : ""} ${chon ? "border-primary bg-primary-soft/40" : ""}`} onClick={onClick ? () => onClick(r) : undefined}>
      <div className="flex items-start gap-2">
        {doiChon && <input type="checkbox" className="mt-1" checked={!!chon} onClick={(e) => e.stopPropagation()} onChange={doiChon} />}
        <div className="min-w-0 flex-1">
          {tieuDe.length > 0 && (
            <div className="text-sm font-semibold leading-snug [&_span]:max-w-none [&_span]:whitespace-normal">
              {tieuDe.map((c, i) => (
                <span key={i}>{c.lay(r)} </span>
              ))}
            </div>
          )}
          {phu.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-soft">
              {phu.map((c, i) => (
                <span key={i}>{c.lay(r)}</span>
              ))}
            </div>
          )}
        </div>
        {nhan.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 text-xs text-ink-soft">
            {nhan.map((c, i) => (
              <span key={i}>{c.lay(r)}</span>
            ))}
          </div>
        )}
      </div>
      {kv.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-2 text-xs sm:grid-cols-3">
          {kv.map((c, i) => (
            <div key={i} className="min-w-0">
              <dt className="truncate text-ink-soft">{c.ten}</dt>
              <dd className={`truncate font-medium ${c.so ? "tabular-nums" : ""}`}>{c.lay(r)}</dd>
            </div>
          ))}
        </dl>
      )}
      {thaoTac.length > 0 && (
        <div className="mt-2 flex justify-end gap-1 border-t border-line pt-2">
          {thaoTac.map((c, i) => (
            <span key={i}>{c.lay(r)}</span>
          ))}
        </div>
      )}
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
  | "tim" | "loc" | "menu" | "dang-xuat" | "kho" | "tien" | "hop" | "lop" | "the";

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
  loc: "M22 3H2l8 9.46V19l4 2v-8.54z",
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
