import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtSo, fmtThang } from "../lib/api";
import { BieuDoCot } from "./bieuDo";
import { Drawer, Loi, TaiDang } from "./ui";

// Drawer "chi tiet linh kien" dung chung moi bao cao: useMoLk()(ma) mo tu bat ky dong nao.
interface Kq {
  ma: string; ten: string; thang: string[]; moc_ton_kho: string | null;
  khai_bao: { phan_loai?: string | null; nganh?: string | null; noi_san_xuat?: string | null; he_so_du_tru?: number | null; leadtime?: number | null; gia_nhap?: number | null; gia_nhap_nguon?: string } | null;
  ton: { ma_kho: string; ten_kho: string; loai_kho: string; dau_ky: number; nhap_kho: number; xuat_kho: number; cuoi_ky: number }[];
  xuat: { thang: string; ma_kho: string; ten_kho: string; loai_kho: string; sl: number }[];
  so_chi_tiet: { ma_kho: string; ten_kho: string | null; ngay_hach_toan: string; so_chung_tu: string | null; dien_giai: string | null; sl_nhap: number; sl_xuat: number }[];
}

const Ctx = createContext<(ma: string) => void>(() => {});
export const useMoLk = () => useContext(Ctx);

const LOAI_KHO: Record<string, string> = { cong_ty: "Kho công ty", ktv: "Kho KTV", khac: "Khác", bo_qua: "Bỏ qua" };

export function ChiTietLkProvider({ children }: { children: ReactNode }) {
  const [ma, setMa] = useState<string | null>(null);
  const mo = useCallback((m: string) => setMa(m), []);
  const dong = useCallback(() => setMa(null), []);
  // Doi trang (hash) -> dong drawer.
  useEffect(() => {
    addEventListener("hashchange", dong);
    return () => removeEventListener("hashchange", dong);
  }, [dong]);
  return (
    <Ctx.Provider value={mo}>
      {children}
      {ma && <ChiTietLk ma={ma} dong={dong} />}
    </Ctx.Provider>
  );
}

function ChiTietLk({ ma, dong }: { ma: string; dong: () => void }) {
  const q = useQuery({ queryKey: ["lk", ma], queryFn: () => api<Kq>(`/bao-cao/lk/${encodeURIComponent(ma)}`) });
  const d = q.data;
  const [chiCongTy, setChiCongTy] = useState(true);
  const xuatThang = useMemo(() => {
    if (!d) return [];
    return [...d.thang].reverse().map((t) => ({
      nhan: `${t.slice(4, 6)}/${t.slice(2, 4)}`,
      gia_tri: d.xuat.filter((x) => x.thang === t && (!chiCongTy || x.loai_kho !== "ktv")).reduce((a, x) => a + x.sl, 0),
    }));
  }, [d, chiCongTy]);
  const tonCongTy = d?.ton.filter((t) => t.loai_kho !== "ktv") ?? [];
  const tonKtv = d?.ton.filter((t) => t.loai_kho === "ktv") ?? [];
  const kb = d?.khai_bao;
  return (
    <Drawer mo dong={dong} tieuDe={<span className="font-mono">{ma}</span>} phu={d?.ten}>
      {q.isLoading ? (
        <TaiDang />
      ) : q.error ? (
        <Loi loi={q.error} />
      ) : d ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            {[
              ["Phân loại", kb?.phan_loai ?? "Chưa khai báo"],
              ["Ngành", kb?.nganh ?? "—"],
              ["Nơi SX", kb?.noi_san_xuat ?? "—"],
              ["Hệ số dự trữ", kb?.he_so_du_tru != null ? fmtSo(kb.he_so_du_tru, 2) : "Mặc định"],
              ["Leadtime", kb?.leadtime != null ? `${fmtSo(kb.leadtime)} ngày` : "Mặc định"],
              ["Giá nhập", kb?.gia_nhap_nguon === "nhap" ? fmtSo(kb.gia_nhap) : kb?.gia_nhap_nguon === "du_phong" ? `${fmtSo(kb.gia_nhap)} (giá dự phòng)` : "Chưa có"],
              ["Tồn kho công ty", fmtSo(tonCongTy.reduce((a, t) => a + t.cuoi_ky, 0), 2) || "0"],
              ["Tồn kho KTV", fmtSo(tonKtv.reduce((a, t) => a + t.cuoi_ky, 0), 2) || "0"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-subtle px-3 py-2">
                <div className="text-xs text-ink-soft">{k}</div>
                <div className="font-medium">{v}</div>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="card-title">Xuất kho {d.thang.length} tháng</h3>
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                <input type="checkbox" checked={chiCongTy} onChange={(e) => setChiCongTy(e.target.checked)} />
                Chỉ kho công ty (như báo cáo đắp chiếu)
              </label>
            </div>
            <BieuDoCot data={xuatThang} cao={190} />
          </section>

          <section>
            <h3 className="card-title mb-2">Tồn kho theo kho {d.moc_ton_kho && <span className="font-normal text-ink-soft">· cập nhật {d.moc_ton_kho}</span>}</h3>
            {d.ton.length ? (
              <div className="max-h-64 overflow-auto rounded-lg border border-line">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Kho</th>
                      <th>Loại</th>
                      <th className="so">Đầu kỳ</th>
                      <th className="so">Nhập</th>
                      <th className="so">Xuất</th>
                      <th className="so">Cuối kỳ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.ton.map((t) => (
                      <tr key={t.ma_kho}>
                        <td>{t.ten_kho}</td>
                        <td className="text-ink-soft">{LOAI_KHO[t.loai_kho] ?? t.loai_kho}</td>
                        <td className="so">{fmtSo(t.dau_ky, 2)}</td>
                        <td className="so">{fmtSo(t.nhap_kho, 2)}</td>
                        <td className="so">{fmtSo(t.xuat_kho, 2)}</td>
                        <td className="so font-semibold">{fmtSo(t.cuoi_ky, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Không có tồn ở phiên tồn kho hiện tại.</p>
            )}
          </section>

          <section>
            <h3 className="card-title mb-2">Sổ chi tiết gần nhất</h3>
            {d.so_chi_tiet.length ? (
              <div className="max-h-72 overflow-auto rounded-lg border border-line">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Kho</th>
                      <th>Chứng từ</th>
                      <th>Diễn giải</th>
                      <th className="so">Nhập</th>
                      <th className="so">Xuất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.so_chi_tiet.map((s, i) => (
                      <tr key={i}>
                        <td>{s.ngay_hach_toan}</td>
                        <td>{s.ten_kho ?? s.ma_kho}</td>
                        <td className="font-mono text-xs">{s.so_chung_tu}</td>
                        <td>
                          <span className="inline-block max-w-[220px] truncate align-bottom" title={s.dien_giai ?? ""}>
                            {s.dien_giai}
                          </span>
                        </td>
                        <td className="so">{fmtSo(s.sl_nhap || null, 2)}</td>
                        <td className="so">{fmtSo(s.sl_xuat || null, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Chưa có phát sinh trong sổ chi tiết đã import.</p>
            )}
          </section>
          <p className="text-xs text-ink-soft">Tháng gần nhất: {fmtThang(d.thang[0])} (lũy kế tới ngày sổ chi tiết mới nhất).</p>
        </div>
      ) : null}
    </Drawer>
  );
}
