import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtSo, fmtThang } from "../lib/api";
import { BieuDoCot, soGon } from "./bieuDo";
import { Loi, NhanCanhBao, NhanXepLoai, TaiDang, useMobile } from "./ui";
import { boDau } from "../lib/excel";

// "Hồ sơ linh kiện" (2026-10-30) - bam 1 dong / 1 ma o bat ky bao cao nao -> popup ~95% man hinh gom MOI so lieu app co ve
// ma do. Bo cuc theo "Hồ sơ linh kiện" ben app DVBH (dvbh-suite components/HoSoLinhKien.tsx v1.508): hang the so lieu +
// "Nhận định nhanh", cac VUNG danh so theo luong phan tich, moi phan 1 the co vach mau trai + so dem, phan rong thu lai
// thanh 1 dong mo. Du lieu: GET /bao-cao/lk/:ma (tinh lai bang bo tinh chung chi cho ma nay -> khop dong trong bao cao).
// Mo tu bat ky dau: useMoLk()(ma, dsMa?) - dsMa = danh sach dang xem de chuyen ‹ › giua cac ma. Ma dang mo nam tren URL
// (?lk=) -> gui link la mo dung ho so.

interface DcDong {
  nhom: string; ma: string; ten: string; xep_loai: string; phan_loai_dap_chieu: string; phan_loai: string; he_so: number; ton: number;
  tb3: number; tb6: number; du_tru: number; ton_du: number; gia_nhap: number; gia_nhap_nguon: string; gia_tri_ton: number; gia_tri_ton_du: number; xuat: number[];
}
interface LtDong {
  kho: string; ma_kho: string | null; tieu_hao: [number, number, number]; ton: number; so_ngay_du: (number | null)[]; canh_bao: [string, string, string];
  tb_ngay: number; ton_chuan: number; sl_thieu_can_dat: number; tan_suat: string; he_so_nk: number; leadtime: number; hang_dang_ve: number;
  du_tru: number | null; ton_du: number | null; dvbh_so_ca: number;
}
interface ThDong { kho: string; ma_kho: string; xuat: number | null; ton: number; lam_viec: boolean; ton_chuan: number; nhom: string; danh_gia: string; phong_ban: string; khu_vuc: string }
interface Kq {
  ma: string; ten: string; thang: string[]; moc_ton_kho: string | null; moc_so_chi_tiet: string | null; he_so_thu_hoi: number | null;
  khai_bao: { phan_loai?: string | null; nganh?: string | null; noi_san_xuat?: string | null; he_so_du_tru?: number | null; leadtime?: number | null; doi_tac?: string | null; nhom_tuong_duong?: string | null; gia_nhap?: number | null; gia_nhap_nguon?: string } | null;
  danh_muc: { ten: string | null; nhom_lk: string | null; phan_loai_vat_ly: string | null; gia_du_phong: number | null; bat_tat: number; dong_bo_luc: string } | null;
  tham_so: { he_so_du_tru_mac_dinh: number; leadtime_mac_dinh: number; he_so_nk_mac_dinh: number };
  ton: { ma_kho: string; ten_kho: string; loai_kho: string; dau_ky: number; nhap_kho: number; xuat_kho: number; cuoi_ky: number }[];
  xuat: { thang: string; ma_kho: string; ten_kho: string; loai_kho: string; sl: number }[];
  so_chi_tiet: { ma_kho: string; ten_kho: string | null; ngay_hach_toan: string; so_chung_tu: string | null; dien_giai: string | null; sl_nhap: number; sl_xuat: number; tk_doi_ung: string | null }[];
  dap_chieu: { theo_kho: DcDong[]; gop_rieng_ktv: DcDong[]; toan_quoc: DcDong | null; t5: string[] };
  leadtime: { ngay_moc: string | null; cua_so: [number, number, number]; theo_kho: LtDong[]; gop: LtDong | null };
  thu_hoi: { ky_tu_ngay: string | null; ky_den_ngay: string | null; so_ky_2_tuan: number; rows: ThDong[] };
}

// ---------------------------------------------------------------- Provider + mo tu bat ky dau
type MoLk = (ma: string, dsMa?: string[]) => void;
const Ctx = createContext<MoLk>(() => {});
export const useMoLk = () => useContext(Ctx);

const docLkUrl = () => new URLSearchParams(location.hash.split("?")[1] ?? "").get("lk");
function ghiLkUrl(ma: string | null) {
  const [goc, q = ""] = location.hash.split("?");
  const p = new URLSearchParams(q);
  if (ma) p.set("lk", ma);
  else p.delete("lk");
  const s = p.toString();
  history.replaceState(null, "", `${goc || "#/"}${s ? `?${s}` : ""}`);
}

export function HoSoLkProvider({ children }: { children: ReactNode }) {
  const [dang, setDang] = useState<{ ma: string; ds: string[] } | null>(() => {
    const ma = docLkUrl();
    return ma ? { ma, ds: [] } : null;
  });
  const mo = useCallback<MoLk>((ma, dsMa) => {
    setDang({ ma, ds: dsMa ? [...new Set(dsMa)] : [] });
    ghiLkUrl(ma);
  }, []);
  const dong = useCallback(() => {
    setDang(null);
    ghiLkUrl(null);
  }, []);
  // Doi trang -> dong ho so (link moi khong mang ?lk).
  useEffect(() => {
    const f = () => setDang(docLkUrl() ? { ma: docLkUrl()!, ds: [] } : null);
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return (
    <Ctx.Provider value={mo}>
      {children}
      {dang && <HoSoPopup ma={dang.ma} ds={dang.ds} doiMa={(m) => (setDang({ ...dang, ma: m }), ghiLkUrl(m))} dong={dong} />}
    </Ctx.Provider>
  );
}

// ---------------------------------------------------------------- Khung popup ~95% man hinh
function HoSoPopup({ ma, ds, doiMa, dong }: { ma: string; ds: string[]; doiMa: (m: string) => void; dong: () => void }) {
  const q = useQuery({ queryKey: ["lk", ma], queryFn: () => api<Kq>(`/bao-cao/lk/${encodeURIComponent(ma)}`) });
  const i = ds.indexOf(ma);
  const truoc = i > 0 ? ds[i - 1] : null;
  const sau = i >= 0 && i < ds.length - 1 ? ds[i + 1] : null;
  const [daChep, setDaChep] = useState(false);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") dong();
      if (e.key === "ArrowLeft" && truoc) doiMa(truoc);
      if (e.key === "ArrowRight" && sau) doiMa(sau);
    };
    addEventListener("keydown", f);
    const tran = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", f);
      document.body.style.overflow = tran;
    };
  }, [dong, doiMa, truoc, sau]);
  const d = q.data;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 md:p-[2vh_2vw]" onClick={dong}>
      <div className="flex h-full w-full max-w-[1800px] flex-col overflow-hidden bg-subtle shadow-2xl md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-start gap-3 border-b border-line bg-white px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Hồ sơ linh kiện</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-bold md:text-xl">{ma}</span>
              <span className="min-w-0 text-base font-semibold text-ink md:text-lg">{d?.ten && d.ten !== ma ? d.ten : ""}</span>
            </div>
            {d && <NhanDau d={d} />}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {ds.length > 1 && i >= 0 && (
              <>
                <button className="btn btn-sm" disabled={!truoc} onClick={() => truoc && doiMa(truoc)} title="Mã trước (←)">
                  ‹
                </button>
                <span className="px-1 text-xs tabular-nums text-ink-soft">
                  {i + 1}/{ds.length}
                </span>
                <button className="btn btn-sm" disabled={!sau} onClick={() => sau && doiMa(sau)} title="Mã sau (→)">
                  ›
                </button>
              </>
            )}
            <button
              className="btn btn-sm hidden sm:inline-flex"
              title="Chép link mở thẳng hồ sơ này"
              onClick={() => navigator.clipboard?.writeText(location.href).then(() => (setDaChep(true), setTimeout(() => setDaChep(false), 1500)))}
            >
              {daChep ? "✓ Đã chép" : "🔗 Link"}
            </button>
            <button className="btn btn-sm" onClick={dong} aria-label="Đóng">
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:py-5">
          {q.isLoading ? <TaiDang chu="Đang tính hồ sơ linh kiện…" /> : q.error ? <Loi loi={q.error} /> : d ? <NoiDung d={d} /> : null}
        </div>
      </div>
    </div>
  );
}

// Nhan tom tat duoi ten: phan loai, nganh, noi SX, rui ro / dap chieu (gop chung - rieng KTV), muc canh bao leadtime.
function NhanDau({ d }: { d: Kq }) {
  const gop = d.dap_chieu.gop_rieng_ktv.find((r) => r.nhom === "Gộp chung");
  const lt = d.leadtime.gop;
  const kb = d.khai_bao;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
      {gop && <NhanXepLoai v={gop.xep_loai} />}
      {gop && <span className="chip">Đắp chiếu {gop.phan_loai_dap_chieu}</span>}
      {lt && <NhanCanhBao v={lt.canh_bao[0]} />}
      <span className="chip">{kb?.phan_loai ?? "Chưa khai báo phân loại"}</span>
      {kb?.nganh && <span className="chip">{kb.nganh}</span>}
      {kb?.noi_san_xuat && <span className="chip">{kb.noi_san_xuat}</span>}
      {d.danh_muc?.nhom_lk && <span className="chip">LK {d.danh_muc.nhom_lk === "b2b" ? "B2B" : "Karofi"}</span>}
      {d.danh_muc && !d.danh_muc.bat_tat && <span className="chip border-amber-300 text-warning">Đang tắt ở danh mục</span>}
    </div>
  );
}

// ---------------------------------------------------------------- Khung trinh bay (theo DVBH: Zone + Section)
type Tone = "primary" | "danger" | "warning" | "success" | "gray";
const TONE: Record<Tone, { vach: string; nen: string; chu: string }> = {
  primary: { vach: "var(--color-primary)", nen: "var(--color-primary-soft)", chu: "var(--color-primary)" },
  danger: { vach: "var(--color-danger)", nen: "var(--color-danger-soft)", chu: "var(--color-danger)" },
  warning: { vach: "var(--color-warning)", nen: "var(--color-warning-soft)", chu: "var(--color-warning)" },
  success: { vach: "var(--color-success)", nen: "var(--color-success-soft)", chu: "var(--color-success)" },
  gray: { vach: "#94a3b8", nen: "var(--color-subtle)", chu: "var(--color-text-secondary)" },
};

function Vung({ n, ten, goiY, phai, children }: { n: number; ten: string; goiY?: string; phai?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{n}</span>
        <h3 className="whitespace-nowrap text-sm font-bold uppercase tracking-wide text-ink">{ten}</h3>
        {goiY && <span className="hidden truncate text-xs text-ink-soft lg:inline">— {goiY}</span>}
        <div className="h-px flex-1 bg-line" />
        {phai}
      </div>
      {children}
    </section>
  );
}

function The({ ten, icon, tone, dem, rong, phai, children }: { ten: string; icon: string; tone: Tone; dem?: number; rong?: string | null; phai?: ReactNode; children?: ReactNode }) {
  const c = TONE[tone];
  return (
    <div className={`min-w-0 overflow-hidden rounded-xl border border-line bg-white ${rong ? "opacity-70" : "shadow-sm"}`} style={{ borderLeft: `4px solid ${rong ? "var(--color-border)" : c.vach}` }}>
      <div className={`flex items-center gap-2 px-3 py-2 ${rong ? "" : "border-b border-line"}`} style={rong ? undefined : { background: `color-mix(in srgb, ${c.nen} 60%, white)` }}>
        <span className="text-sm leading-none">{icon}</span>
        <span className="whitespace-nowrap text-sm font-semibold" style={{ color: rong ? "var(--color-text-secondary)" : c.chu }}>
          {ten}
        </span>
        {dem !== undefined && (
          <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold" style={dem > 0 ? { background: c.vach, color: "white" } : { background: "var(--color-subtle)", color: "var(--color-text-secondary)" }}>
            {dem.toLocaleString("vi-VN")}
          </span>
        )}
        {rong && <span className="truncate text-xs italic text-ink-soft">· {rong}</span>}
        {phai && <span className="ml-auto text-xs">{phai}</span>}
      </div>
      {!rong && <div className="p-2">{children}</div>}
    </div>
  );
}

function OSo({ nhan, so, phu, tone, mo }: { nhan: string; so: ReactNode; phu?: ReactNode; tone?: Tone; mo?: boolean }) {
  const c = tone ? TONE[tone] : null;
  return (
    <div className={`min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 ${mo ? "opacity-60" : ""}`} style={c && !mo ? { borderTop: `3px solid ${c.vach}` } : undefined}>
      <div className="truncate text-[11px] font-medium text-ink-soft">{nhan}</div>
      <div className="mt-0.5 truncate text-lg font-bold tabular-nums md:text-xl" style={c && !mo ? { color: c.chu } : undefined}>
        {so}
      </div>
      {phu && <div className="truncate text-[11px] text-ink-soft">{phu}</div>}
    </div>
  );
}

const TH = "whitespace-nowrap px-2 py-1.5";
const BangNho = ({ children, cao = "max-h-72" }: { children: ReactNode; cao?: string }) => (
  <div className={`overflow-auto ${cao}`}>
    <table className="w-full border-collapse text-xs [&_td]:border-b [&_td]:border-line [&_td]:px-2 [&_td]:py-1.5 [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:border-b [&_th]:border-line [&_th]:bg-white [&_th]:text-left [&_th]:font-semibold [&_th]:uppercase [&_th]:text-ink-soft [&_tr:last-child_td]:border-0">
      {children}
    </table>
  </div>
);
const So = ({ v, d = 0, cls = "" }: { v: number | null | undefined; d?: number; cls?: string }) => <td className={`text-right tabular-nums ${cls}`}>{v == null ? "—" : fmtSo(v, d) || "0"}</td>;

// ---------------------------------------------------------------- Noi dung
function NoiDung({ d }: { d: Kq }) {
  const mobile = useMobile();
  const gop = d.dap_chieu.gop_rieng_ktv.find((r) => r.nhom === "Gộp chung") ?? null;
  const ktvChung = d.dap_chieu.gop_rieng_ktv.find((r) => r.nhom === "Kho KTV chung") ?? null;
  const lt = d.leadtime.gop;
  const tonCongTy = d.ton.filter((t) => t.loai_kho !== "ktv" && t.loai_kho !== "bo_qua");
  const tonKtv = d.ton.filter((t) => t.loai_kho === "ktv" && t.cuoi_ky > 0);
  const sum = (a: { cuoi_ky: number }[]) => a.reduce((s, t) => s + t.cuoi_ky, 0);
  const slCongTy = sum(tonCongTy);
  const slKtv = sum(tonKtv);
  const thuHoi12 = d.thu_hoi.rows.filter((r) => r.nhom === "Nhóm 1" || r.nhom === "Nhóm 2");
  const slThuHoi12 = thuHoi12.reduce((s, r) => s + r.ton, 0);
  const soNgayDu = lt?.so_ngay_du[0] ?? null;
  const kb = d.khai_bao;

  // Nhan dinh nhanh - thu tu uu tien: thieu (T5 / leadtime 1-2) -> toi diem dat -> ton thua (T4 / dap chieu lau) -> binh thuong.
  const nd = (() => {
    if (!gop && !lt && !d.ton.length) return { tone: "gray" as Tone, icon: "ℹ️", tieuDe: "Chưa có phát sinh", chu: "Mã này chưa có tồn kho lẫn xuất kho trong dữ liệu đã nhập." };
    const muc = lt?.canh_bao[0] ?? "";
    if (gop?.xep_loai === "T5" || muc.startsWith("1.") || muc.startsWith("2."))
      return {
        tone: "danger" as Tone,
        icon: "⛔",
        tieuDe: muc.startsWith("1.") ? "Thiếu hàng nghiêm trọng — cần đặt ngay" : "Nguy cơ thiếu hàng",
        chu: [
          gop && gop.ton_du < 0 && `Tồn kho công ty ${fmtSo(gop.ton, 2)} thấp hơn SL dự trữ ${fmtSo(gop.du_tru)} (thiếu ${fmtSo(-gop.ton_du, 2)}).`,
          lt && lt.sl_thieu_can_dat > 0 && `Theo leadtime cần đặt khoảng ${fmtSo(lt.sl_thieu_can_dat, 1)} để đủ tồn chuẩn ${fmtSo(lt.ton_chuan, 1)}.`,
          slKtv > 0 && `KTV đang giữ ${fmtSo(slKtv, 2)} — có thể điều chuyển ${slThuHoi12 > 0 ? `(${fmtSo(slThuHoi12, 2)} thuộc nhóm thu hồi 1–2)` : ""}.`,
        ]
          .filter(Boolean)
          .join(" "),
      };
    if (muc.startsWith("3.")) return { tone: "warning" as Tone, icon: "⏰", tieuDe: "Tới thời điểm đặt hàng", chu: `Tồn hiện tại đủ dùng khoảng ${fmtSo((soNgayDu ?? 0) + d.leadtime.cua_so[0] + (lt?.leadtime ?? 0), 1)} ngày, chỉ còn ${fmtSo(soNgayDu, 1)} ngày trước mốc leadtime ${fmtSo(lt?.leadtime)} ngày.` };
    const dcThang = gop ? Number(gop.phan_loai_dap_chieu.slice(1)) : 0;
    if (gop?.xep_loai === "T4" || (dcThang >= 3 && (gop?.ton ?? 0) > 0))
      return {
        tone: "warning" as Tone,
        icon: "📦",
        tieuDe: dcThang >= 3 ? `Đắp chiếu ${dcThang >= 12 ? "≥ 12" : dcThang} tháng không xuất` : "Tồn vượt chuẩn",
        chu: [
          gop && gop.ton_du > 0 && `Tồn dư ${fmtSo(gop.ton_du, 2)} so với SL dự trữ ${fmtSo(gop.du_tru)}${gop.gia_tri_ton_du > 0 ? ` (≈ ${soGon(gop.gia_tri_ton_du)})` : ""}.`,
          "Cân nhắc dừng đặt / điều chuyển.",
          slThuHoi12 > 0 && `${fmtSo(slThuHoi12, 2)} ở kho KTV thuộc nhóm thu hồi 1–2.`,
        ]
          .filter(Boolean)
          .join(" "),
      };
    return { tone: "success" as Tone, icon: "✅", tieuDe: "Bình thường", chu: `Tồn trong ngưỡng dự trữ${soNgayDu != null ? `, còn dư khoảng ${fmtSo(soNgayDu, 1)} ngày sau leadtime` : ""}.${slThuHoi12 > 0 ? ` Lưu ý: ${fmtSo(slThuHoi12, 2)} ở kho KTV thuộc nhóm thu hồi 1–2.` : ""}` };
  })();
  const ndc = TONE[nd.tone];

  return (
    <div className="space-y-6">
      {/* Diem nhan: so lieu chinh + nhan dinh */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          <OSo nhan="Tồn kho công ty" so={fmtSo(slCongTy, 2) || "0"} tone="primary" mo={!slCongTy} phu={`${tonCongTy.filter((t) => t.cuoi_ky > 0).length} kho có hàng`} />
          <OSo nhan="KTV đang giữ" so={fmtSo(slKtv, 2) || "0"} tone="primary" mo={!slKtv} phu={`${tonKtv.length} kho KTV`} />
          <OSo nhan="TB xuất 3 tháng" so={fmtSo(gop?.tb3 ?? 0)} phu={`tháng N: ${fmtSo(gop?.xuat[0] ?? 0, 2) || 0}`} />
          <OSo nhan="SL dự trữ chuẩn" so={fmtSo(gop?.du_tru ?? 0)} phu={`hệ số ${fmtSo(gop?.he_so ?? kb?.he_so_du_tru ?? d.tham_so.he_so_du_tru_mac_dinh, 2)}`} />
          <OSo nhan="Tồn dư" so={fmtSo(gop?.ton_du ?? 0, 2) || "0"} tone={(gop?.ton_du ?? 0) < 0 ? "danger" : (gop?.xep_loai === "T4" ? "warning" : "success")} phu={gop ? `xếp loại ${gop.xep_loai}` : "—"} />
          <OSo nhan={`Số ngày dư (${d.leadtime.cua_so[0]}N)`} so={soNgayDu == null ? "—" : fmtSo(soNgayDu, 1)} tone={soNgayDu != null && soNgayDu < 0 ? "danger" : soNgayDu != null && soNgayDu <= 2 ? "warning" : undefined} phu={`leadtime ${fmtSo(lt?.leadtime ?? kb?.leadtime ?? d.tham_so.leadtime_mac_dinh)} ngày`} />
          <OSo nhan="SL cần đặt (leadtime)" so={fmtSo(Math.max(0, lt?.sl_thieu_can_dat ?? 0), 1) || "0"} tone="danger" mo={!(lt && lt.sl_thieu_can_dat > 0)} phu={`tồn chuẩn ${fmtSo(lt?.ton_chuan ?? 0, 1)}`} />
          <OSo nhan="Đề xuất thu hồi (N1+N2)" so={fmtSo(slThuHoi12, 2) || "0"} tone="warning" mo={!slThuHoi12} phu={`${thuHoi12.length} kho KTV`} />
        </div>
        <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: ndc.nen, borderLeft: `5px solid ${ndc.vach}` }}>
          <span className="mt-0.5 text-xl leading-none">{nd.icon}</span>
          <div>
            <div className="text-sm font-bold" style={{ color: ndc.chu }}>
              {nd.tieuDe}
            </div>
            <div className="text-sm text-ink">{nd.chu}</div>
          </div>
        </div>
      </div>

      <Vung n={1} ten="Tiêu hao" goiY={`xuất kho ${d.thang.length} tháng, lũy kế tới ${d.moc_so_chi_tiet ?? "—"}`}>
        <XuatKho d={d} mobile={mobile} />
      </Vung>

      <Vung n={2} ten="Đánh giá rủi ro" goiY="đắp chiếu / dự trữ chuẩn và cảnh báo leadtime">
        <div className="grid gap-3 xl:grid-cols-2 [&>*]:min-w-0">
          <DapChieuThe d={d} gop={gop} ktvChung={ktvChung} />
          <LeadtimeThe d={d} />
        </div>
      </Vung>

      <Vung n={3} ten="Nguồn hàng hiện có" goiY="tồn MISA cuối kỳ" phai={<span className="text-xs text-ink-soft">Tồn cập nhật {d.moc_ton_kho ?? "chưa có"}</span>}>
        <div className="grid gap-3 xl:grid-cols-2 [&>*]:min-w-0">
          <The ten="Tồn theo kho công ty" icon="🏬" tone="primary" dem={tonCongTy.filter((t) => t.cuoi_ky > 0).length} rong={tonCongTy.length ? null : "Không kho công ty nào có mã này."}>
            <BangNho>
              <thead>
                <tr>
                  <th className={TH}>Kho</th>
                  <th className={`${TH} !text-right`}>Đầu kỳ</th>
                  <th className={`${TH} !text-right`}>Nhập</th>
                  <th className={`${TH} !text-right`}>Xuất</th>
                  <th className={`${TH} !text-right`}>Cuối kỳ</th>
                </tr>
              </thead>
              <tbody>
                {tonCongTy.map((t) => (
                  <tr key={t.ma_kho} style={t.cuoi_ky > 0 ? { background: "color-mix(in srgb, var(--color-success-soft) 70%, white)" } : { opacity: 0.6 }}>
                    <td>
                      {t.ten_kho}
                      <span className="font-mono text-ink-soft"> · {t.ma_kho}</span>
                    </td>
                    <So v={t.dau_ky} d={2} />
                    <So v={t.nhap_kho} d={2} />
                    <So v={t.xuat_kho} d={2} />
                    <So v={t.cuoi_ky} d={2} cls="text-sm font-bold" />
                  </tr>
                ))}
              </tbody>
            </BangNho>
          </The>
          <KtvGiuThe d={d} />
        </div>
      </Vung>

      <Vung n={4} ten="Chứng từ & khai báo" goiY="sổ chi tiết vật tư, thông số dùng để tính">
        <SoChiTietThe d={d} />
        <div className="grid gap-3 xl:grid-cols-2 [&>*]:min-w-0">
          <KhaiBaoThe d={d} />
          <div className="space-y-3">
            <The ten="Ca DVBH báo thiếu" icon="🧾" tone="danger" dem={lt?.dvbh_so_ca || undefined} rong={lt?.dvbh_so_ca ? null : "Chưa kết nối API app DVBH."}>
              <div className="px-1 text-sm">{lt?.dvbh_so_ca} ca đang báo thiếu mã này.</div>
            </The>
            <The ten="Hàng đang về (EO Mua hàng)" icon="🚚" tone="primary" dem={lt?.hang_dang_ve || undefined} rong={lt?.hang_dang_ve ? null : "Chưa kết nối API EO Mua hàng."}>
              <div className="px-1 text-sm">Đang về {fmtSo(lt?.hang_dang_ve, 2)} — đã trừ vào SL cần đặt.</div>
            </The>
            <The ten="Đơn đặt / ticket thiếu hàng (linh-kien-app)" icon="🛒" tone="gray" rong="Chưa kết nối API linh-kien-app." />
          </div>
        </div>
      </Vung>
    </div>
  );
}

// ---------------------------------------------------------------- Vung 1: xuat kho
function XuatKho({ d, mobile }: { d: Kq; mobile: boolean }) {
  const [phamVi, setPhamVi] = useState<"cong_ty" | "tat_ca">("cong_ty");
  const thang = d.thang; // [N, N-1, ...]
  const dsXuat = d.xuat.filter((x) => phamVi === "tat_ca" || (x.loai_kho !== "ktv" && x.loai_kho !== "bo_qua"));
  const bieuDo = [...thang].reverse().map((t) => ({ nhan: `${t.slice(4, 6)}/${t.slice(2, 4)}`, gia_tri: dsXuat.filter((x) => x.thang === t).reduce((a, x) => a + x.sl, 0) }));
  // Ma tran kho x thang (kho KTV gop 1 dong "Kho KTV chung" - nhu bao cao).
  const maTran = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const x of dsXuat) {
      const k = x.loai_kho === "ktv" ? "Kho KTV chung" : x.ten_kho;
      const r = m.get(k) ?? new Map<string, number>();
      r.set(x.thang, (r.get(x.thang) ?? 0) + x.sl);
      m.set(k, r);
    }
    return [...m.entries()].sort((a, b) => sumMap(b[1]) - sumMap(a[1]));
  }, [dsXuat]);
  const tong12 = bieuDo.slice(-12).reduce((a, x) => a + x.gia_tri, 0);
  return (
    <div className="grid gap-3 xl:grid-cols-5 [&>*]:min-w-0">
      <div className="xl:col-span-2">
      <The
        ten="Xuất kho theo tháng"
        icon="📈"
        tone="primary"
        phai={
          <select className="input py-0.5 text-xs" value={phamVi} onChange={(e) => setPhamVi(e.target.value as "cong_ty" | "tat_ca")}>
            <option value="cong_ty">Kho công ty (như đắp chiếu)</option>
            <option value="tat_ca">Gồm cả kho KTV</option>
          </select>
        }
      >
        <div className="xl:min-h-[220px]">
          <BieuDoCot data={bieuDo} cao={mobile ? 180 : 230} donVi="SL" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 text-xs text-ink-soft">
          <span>
            12 tháng: <b className="text-ink">{fmtSo(tong12, 2)}</b>
          </span>
          <span>
            TB/tháng: <b className="text-ink">{fmtSo(tong12 / 12, 1)}</b>
          </span>
          <span>
            Tháng không xuất (12T): <b className="text-ink">{bieuDo.slice(-12).filter((x) => !x.gia_tri).length}</b>
          </span>
        </div>
      </The>
      </div>
      <div className="xl:col-span-3">
        <The ten="Xuất theo kho × tháng" icon="🗓️" tone="gray" dem={maTran.length} rong={maTran.length ? null : "Không có phát sinh xuất trong 16 tháng."}>
          <BangNho cao="max-h-80">
            <thead>
              <tr>
                <th className={`${TH} sticky left-0 z-[2]`}>Kho</th>
                {thang.map((t, i) => (
                  <th key={t} className={`${TH} !text-right`}>
                    {i === 0 ? "N " : ""}
                    {fmtThang(t)}
                  </th>
                ))}
                <th className={`${TH} !text-right`}>Tổng</th>
              </tr>
            </thead>
            <tbody>
              {maTran.map(([kho, m]) => (
                <tr key={kho}>
                  <td className="sticky left-0 max-w-[200px] truncate bg-white font-medium" title={kho}>
                    {kho}
                  </td>
                  {thang.map((t) => (
                    <td key={t} className={`text-right tabular-nums ${m.get(t) ? "" : "text-ink-soft/50"}`}>
                      {m.get(t) ? fmtSo(m.get(t)!, 2) : "·"}
                    </td>
                  ))}
                  <So v={sumMap(m)} d={2} cls="font-semibold" />
                </tr>
              ))}
            </tbody>
          </BangNho>
        </The>
      </div>
    </div>
  );
}
const sumMap = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- Vung 2: dap chieu + leadtime
function DapChieuThe({ d, gop, ktvChung }: { d: Kq; gop: DcDong | null; ktvChung: DcDong | null }) {
  const theoKho = d.dap_chieu.theo_kho.filter((r) => r.ton || r.xuat.some((x) => x));
  return (
    <The ten="Đắp chiếu & dự trữ chuẩn" icon="🧮" tone={gop?.xep_loai === "T5" ? "danger" : gop?.xep_loai === "T4" ? "warning" : "primary"} dem={theoKho.length} rong={gop || theoKho.length ? null : "Chưa có tồn / xuất."}>
      {gop && (
        <div className="mb-2 rounded-lg bg-subtle px-3 py-2 text-xs leading-relaxed">
          <b>Gộp kho công ty:</b> TB 3 tháng = ROUNDUP(({fmtSo(gop.xuat[0], 2) || 0} + {fmtSo(gop.xuat[1], 2) || 0} + {fmtSo(gop.xuat[2], 2) || 0}) / 3) = <b>{fmtSo(gop.tb3)}</b> · SL dự trữ = ROUNDUP(({fmtSo(gop.tb3)} + {fmtSo(gop.xuat[0], 2) || 0}) / 2 × {fmtSo(gop.he_so, 2)}) = <b>{fmtSo(gop.du_tru)}</b> · Tồn dư = {fmtSo(gop.ton, 2) || 0} − {fmtSo(gop.du_tru)} ={" "}
          <b className={gop.ton_du < 0 ? "text-danger" : ""}>{fmtSo(gop.ton_du, 2) || 0}</b> → <NhanXepLoai v={gop.xep_loai} /> · {gop.phan_loai_dap_chieu} ({Number(gop.phan_loai_dap_chieu.slice(1)) >= 12 ? "≥ 12" : Number(gop.phan_loai_dap_chieu.slice(1))} tháng liên tiếp không xuất)
          {ktvChung && ktvChung.ton > 0 && (
            <>
              {" "}
              · <b>Kho KTV chung</b> tồn {fmtSo(ktvChung.ton, 2)} (không tính vào dự trữ).
            </>
          )}
          {d.dap_chieu.toan_quoc && <> · Toàn quốc (gộp cả KTV): tồn {fmtSo(d.dap_chieu.toan_quoc.ton, 2)}, xếp loại {d.dap_chieu.toan_quoc.xep_loai}.</>}
        </div>
      )}
      <BangNho>
        <thead>
          <tr>
            <th className={TH}>Kho</th>
            <th className={TH}>Rủi ro</th>
            <th className={`${TH} !text-right`}>Tồn</th>
            <th className={`${TH} !text-right`}>TB 3T</th>
            <th className={`${TH} !text-right`}>TB 6T</th>
            <th className={`${TH} !text-right`}>Dự trữ</th>
            <th className={`${TH} !text-right`}>Tồn dư</th>
            <th className={TH}>Đắp chiếu</th>
            <th className={`${TH} !text-right`}>GT tồn</th>
          </tr>
        </thead>
        <tbody>
          {theoKho.map((r) => (
            <tr key={r.nhom}>
              <td className="max-w-[200px] truncate" title={r.nhom}>
                {r.nhom}
              </td>
              <td>
                <NhanXepLoai v={r.xep_loai} />
              </td>
              <So v={r.ton} d={2} />
              <So v={r.tb3} />
              <So v={r.tb6} />
              <So v={r.du_tru} />
              <So v={r.ton_du} d={2} cls={r.ton_du < 0 ? "font-semibold text-danger" : ""} />
              <td>{r.phan_loai_dap_chieu}</td>
              <td className="text-right tabular-nums">
                {fmtSo(r.gia_tri_ton) || "0"}
                {r.gia_nhap_nguon !== "nhap" && <span className="text-warning" title={r.gia_nhap_nguon === "du_phong" ? "Tạm dùng giá dự phòng" : "Chưa có giá"}>*</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </BangNho>
    </The>
  );
}

function LeadtimeThe({ d }: { d: Kq }) {
  const cs = d.leadtime.cua_so;
  const rows = [...(d.leadtime.gop ? [{ ...d.leadtime.gop, kho: "Gộp kho công ty" }] : []), ...d.leadtime.theo_kho];
  const lt = d.leadtime.gop;
  return (
    <The
      ten="Cảnh báo leadtime"
      icon="⏱️"
      tone={lt?.canh_bao[0].startsWith("1.") || lt?.canh_bao[0].startsWith("2.") ? "danger" : lt?.canh_bao[0].startsWith("3.") ? "warning" : "success"}
      dem={d.leadtime.theo_kho.length}
      rong={rows.length ? null : "Chưa có tiêu hao / tồn ở kho công ty."}
      phai={<span className="text-ink-soft">tiêu hao tới {d.leadtime.ngay_moc ?? "—"}</span>}
    >
      {lt && (
        <div className="mb-2 rounded-lg bg-subtle px-3 py-2 text-xs leading-relaxed">
          TB tiêu hao/ngày = ({fmtSo(lt.tieu_hao[0], 2) || 0}/{cs[0]} + {fmtSo(lt.tieu_hao[1], 2) || 0}/{cs[1]} + {fmtSo(lt.tieu_hao[2], 2) || 0}/{cs[2]}) / 3 = <b>{fmtSo(lt.tb_ngay, 2)}</b> · Tồn chuẩn = {fmtSo(lt.tb_ngay, 2)} × hệ số {fmtSo(lt.he_so_nk, 2)} × 30 ={" "}
          <b>{fmtSo(lt.ton_chuan, 1)}</b> · SL cần đặt = tồn chuẩn − tồn {fmtSo(lt.ton, 2) || 0}
          {lt.hang_dang_ve ? ` − đang về ${fmtSo(lt.hang_dang_ve, 2)}` : ""} = <b className={lt.sl_thieu_can_dat > 0 ? "text-danger" : ""}>{fmtSo(lt.sl_thieu_can_dat, 1)}</b> · Tần suất: <b>{lt.tan_suat}</b>
        </div>
      )}
      <BangNho>
        <thead>
          <tr>
            <th className={TH}>Kho</th>
            {cs.map((c) => (
              <th key={c} className={`${TH} !text-right`}>
                TH {c}N
              </th>
            ))}
            <th className={`${TH} !text-right`}>Tồn</th>
            {cs.map((c) => (
              <th key={`cb${c}`} className={TH}>
                Cảnh báo {c}N <span className="normal-case">(dư)</span>
              </th>
            ))}
            <th className={`${TH} !text-right`}>Cần đặt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.kho + i} className={i === 0 && lt ? "font-semibold" : ""}>
              <td className="max-w-[180px] truncate" title={r.kho}>
                {r.kho}
              </td>
              {r.tieu_hao.map((x, j) => (
                <So key={j} v={x} d={2} />
              ))}
              <So v={r.ton} d={2} />
              {r.canh_bao.map((c, j) => (
                <td key={j} className="whitespace-nowrap">
                  <NhanCanhBao v={c} /> <span className="text-ink-soft">{r.so_ngay_du[j] == null ? "" : fmtSo(r.so_ngay_du[j], 1)}</span>
                </td>
              ))}
              <So v={r.sl_thieu_can_dat} d={1} cls={r.sl_thieu_can_dat > 0 ? "text-danger" : ""} />
            </tr>
          ))}
        </tbody>
      </BangNho>
    </The>
  );
}

// ---------------------------------------------------------------- Vung 3: KTV dang giu (ton KTV + phan nhom thu hoi)
function KtvGiuThe({ d }: { d: Kq }) {
  const rows = [...d.thu_hoi.rows].filter((r) => r.ton > 0).sort((a, b) => a.nhom.localeCompare(b.nhom) || b.ton - a.ton);
  const MAU: Record<string, string> = { "Nhóm 1": "bg-red-100 text-red-700", "Nhóm 2": "bg-orange-100 text-orange-700", "Nhóm 3": "bg-amber-100 text-amber-700", "Nhóm 4": "bg-slate-100 text-slate-600" };
  return (
    <The
      ten="KTV đang giữ hàng — phân nhóm thu hồi"
      icon="🧰"
      tone="warning"
      dem={rows.length}
      rong={rows.length ? null : "Không KTV nào đang giữ mã này."}
      phai={<span className="text-ink-soft">kỳ {d.thu_hoi.ky_tu_ngay ?? "?"} → {d.thu_hoi.ky_den_ngay ?? "?"} · hệ số {fmtSo(d.he_so_thu_hoi ?? 0, 2)}</span>}
    >
      <BangNho>
        <thead>
          <tr>
            <th className={TH}>KTV / kho</th>
            <th className={TH}>Khu vực</th>
            <th className={`${TH} !text-right`}>Xuất kỳ</th>
            <th className={`${TH} !text-right`}>Tồn</th>
            <th className={`${TH} !text-right`}>Tồn chuẩn</th>
            <th className={TH}>Nhóm</th>
            <th className={TH}>Đánh giá</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ma_kho}>
              <td className="max-w-[220px] truncate" title={r.kho}>
                {r.kho}
                {!r.lam_viec && <span className="ml-1 font-semibold text-danger">· Nghỉ</span>}
              </td>
              <td className="whitespace-nowrap text-ink-soft">
                {r.phong_ban} · {r.khu_vuc}
              </td>
              <So v={r.xuat ?? 0} d={2} />
              <So v={r.ton} d={2} cls="font-bold" />
              <So v={r.ton_chuan} />
              <td>
                <span className={`badge whitespace-nowrap ${MAU[r.nhom] ?? ""}`}>{r.nhom}</span>
              </td>
              <td className="whitespace-nowrap">{r.danh_gia}</td>
            </tr>
          ))}
        </tbody>
      </BangNho>
    </The>
  );
}

// ---------------------------------------------------------------- Vung 4: so chi tiet + khai bao
function SoChiTietThe({ d }: { d: Kq }) {
  const [loai, setLoai] = useState<"" | "nhap" | "xuat">("");
  const [kho, setKho] = useState("");
  const [tim, setTim] = useState("");
  const dsKho = [...new Set(d.so_chi_tiet.map((s) => s.ten_kho ?? s.ma_kho))];
  const q = boDau(tim);
  const rows = d.so_chi_tiet.filter(
    (s) => (!loai || (loai === "nhap" ? s.sl_nhap : s.sl_xuat)) && (!kho || (s.ten_kho ?? s.ma_kho) === kho) && (!q || boDau(`${s.so_chung_tu} ${s.dien_giai}`).includes(q)),
  );
  const tongN = rows.reduce((a, s) => a + s.sl_nhap, 0);
  const tongX = rows.reduce((a, s) => a + s.sl_xuat, 0);
  return (
    <The
      ten="Sổ chi tiết vật tư"
      icon="📒"
      tone="primary"
      dem={d.so_chi_tiet.length}
      rong={d.so_chi_tiet.length ? null : "Chưa có phát sinh trong sổ chi tiết đã import."}
      phai={d.so_chi_tiet.length >= 500 ? <span className="text-ink-soft">500 dòng gần nhất</span> : undefined}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1 text-xs">
        <select className="input py-1 text-xs" value={loai} onChange={(e) => setLoai(e.target.value as "" | "nhap" | "xuat")}>
          <option value="">Nhập + xuất</option>
          <option value="nhap">Chỉ nhập</option>
          <option value="xuat">Chỉ xuất</option>
        </select>
        <select className="input max-w-[220px] py-1 text-xs" value={kho} onChange={(e) => setKho(e.target.value)}>
          <option value="">Mọi kho ({dsKho.length})</option>
          {dsKho.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <input className="input w-48 py-1 text-xs" placeholder="Tìm chứng từ / diễn giải…" value={tim} onChange={(e) => setTim(e.target.value)} />
        <span className="ml-auto text-ink-soft">
          {rows.length} dòng · nhập <b className="text-ink">{fmtSo(tongN, 2) || 0}</b> · xuất <b className="text-ink">{fmtSo(tongX, 2) || 0}</b>
        </span>
      </div>
      <BangNho cao="max-h-80">
        <thead>
          <tr>
            <th className={TH}>Ngày HT</th>
            <th className={TH}>Kho</th>
            <th className={TH}>Chứng từ</th>
            <th className={TH}>Diễn giải</th>
            <th className={TH}>TK ĐƯ</th>
            <th className={`${TH} !text-right`}>Nhập</th>
            <th className={`${TH} !text-right`}>Xuất</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap">{s.ngay_hach_toan}</td>
              <td className="max-w-[180px] truncate">{s.ten_kho ?? s.ma_kho}</td>
              <td className="whitespace-nowrap font-mono">{s.so_chung_tu}</td>
              <td className="max-w-[420px] truncate" title={s.dien_giai ?? ""}>
                {s.dien_giai}
              </td>
              <td>{s.tk_doi_ung}</td>
              <So v={s.sl_nhap || null} d={2} cls="text-success" />
              <So v={s.sl_xuat || null} d={2} />
            </tr>
          ))}
        </tbody>
      </BangNho>
    </The>
  );
}

function KhaiBaoThe({ d }: { d: Kq }) {
  const kb = d.khai_bao;
  const ts = d.tham_so;
  const md = (v: number | null | undefined, m: number, dv = "") => (v != null ? `${fmtSo(v, 2)}${dv}` : <span className="text-ink-soft">mặc định {fmtSo(m, 2)}{dv}</span>);
  const gia =
    kb?.gia_nhap_nguon === "nhap" ? fmtSo(kb.gia_nhap) : kb?.gia_nhap_nguon === "du_phong" ? <span className="text-warning">{fmtSo(kb.gia_nhap)} (tạm dùng giá dự phòng)</span> : <span className="text-ink-soft">Chưa có (tính = 0)</span>;
  const dong: [string, ReactNode][] = [
    ["Phân loại", kb?.phan_loai ?? <span className="text-warning">Chưa khai báo</span>],
    ["Hệ số thu hồi (theo phân loại)", fmtSo(d.he_so_thu_hoi ?? 0, 2)],
    ["Ngành", kb?.nganh ?? "—"],
    ["Nơi sản xuất", kb?.noi_san_xuat ?? "—"],
    ["Hệ số dự trữ", md(kb?.he_so_du_tru, ts.he_so_du_tru_mac_dinh)],
    ["Leadtime", md(kb?.leadtime, ts.leadtime_mac_dinh, " ngày")],
    ["Đối tác", kb?.doi_tac ?? "—"],
    ["Nhóm tương đương", kb?.nhom_tuong_duong ?? "—"],
    ["Giá nhập", gia],
    ["Danh mục linh-kien-app", d.danh_muc ? `${d.danh_muc.nhom_lk === "b2b" ? "B2B" : "Karofi"}${d.danh_muc.phan_loai_vat_ly ? ` · ${d.danh_muc.phan_loai_vat_ly}` : ""} · đồng bộ ${d.danh_muc.dong_bo_luc}` : <span className="text-ink-soft">Chưa đồng bộ</span>],
  ];
  return (
    <The ten="Khai báo dùng để tính" icon="⚙️" tone="gray" phai={<a className="text-primary hover:underline" href={`#/cai-dat/lk?bang.q=${encodeURIComponent(d.ma)}`}>Sửa khai báo →</a>}>
      <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {dong.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line px-1 py-1.5 text-xs last:border-0">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </The>
  );
}

