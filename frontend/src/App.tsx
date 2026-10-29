import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./lib/api";
import { Icon, TaiDang, type IconTen } from "./components/ui";
import { ChiTietLkProvider } from "./components/ChiTietLk";

const TongQuan = lazy(() => import("./pages/TongQuan"));
const DapChieu = lazy(() => import("./pages/DapChieu"));
const Leadtime = lazy(() => import("./pages/Leadtime"));
const ThuHoi = lazy(() => import("./pages/ThuHoi"));
const ImportDuLieu = lazy(() => import("./pages/ImportDuLieu"));
const CaiDat = lazy(() => import("./pages/CaiDat"));
const NguoiDung = lazy(() => import("./pages/NguoiDung"));
const QuanTriDuLieu = lazy(() => import("./pages/QuanTriDuLieu"));
const NhatKy = lazy(() => import("./pages/NhatKy"));

export type VaiTro = "admin" | "nhap_lieu" | "xem";
interface Me { email: string; ten: string | null; vai_tro: VaiTro; trang_thai: string }
export interface Moc {
  ton_kho: { phien_ban: string; xong_luc: string; ky_tu_ngay: string | null; ky_den_ngay: string | null } | null;
  so_chi_tiet: { tu: string | null; den: string | null; n: number };
  xuat_thang_tinh: { tu: string | null; den: string | null; so_thang: number };
  linh_kien: { n: number; luc: string | null };
}

interface Trang { k: string; t: string; icon: IconTen; vaiTro?: VaiTro[] }
const NHOM: { t: string; ds: Trang[] }[] = [
  { t: "", ds: [{ k: "tong-quan", t: "Tổng quan", icon: "tong-quan" }] },
  {
    t: "Báo cáo",
    ds: [
      { k: "dap-chieu", t: "Đắp chiếu", icon: "dap-chieu" },
      { k: "t5", t: "Cảnh báo T5", icon: "canh-bao" },
      { k: "leadtime", t: "Cảnh báo leadtime", icon: "dong-ho" },
      { k: "thu-hoi", t: "LK thu hồi DVBH", icon: "thu-hoi" },
    ],
  },
  { t: "Dữ liệu", ds: [{ k: "nhap-du-lieu", t: "Nhập dữ liệu", icon: "tai-len", vaiTro: ["admin", "nhap_lieu"] }] },
  {
    t: "Cài đặt",
    ds: [
      { k: "cai-dat/lk", t: "Khai báo linh kiện", icon: "hop" },
      { k: "cai-dat/phan-loai", t: "Phân loại & thu hồi", icon: "the" },
      { k: "cai-dat/kho", t: "Kho", icon: "kho" },
      { k: "cai-dat/tham-so", t: "Tham số tính toán", icon: "cai-dat" },
    ],
  },
  {
    t: "Quản trị",
    ds: [
      { k: "quan-tri/nguoi-dung", t: "Người dùng", icon: "nguoi", vaiTro: ["admin"] },
      { k: "quan-tri/du-lieu", t: "Dữ liệu hệ thống", icon: "du-lieu", vaiTro: ["admin"] },
      { k: "quan-tri/nhat-ky", t: "Nhật ký", icon: "nhat-ky", vaiTro: ["admin"] },
    ],
  },
];
const TEN_VAI_TRO: Record<VaiTro, string> = { admin: "Admin", nhap_lieu: "Nhập liệu", xem: "Chỉ xem" };

const docHash = () => location.hash.replace(/^#\/?/, "") || "tong-quan";

export default function App() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me"), retry: false });
  const [trang, setTrang] = useState(docHash);
  const [moMenu, setMoMenu] = useState(false);
  useEffect(() => {
    const f = () => (setTrang(docHash()), setMoMenu(false));
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  const dangXuat = () => api("/auth/logout", { method: "POST" }).then(() => qc.invalidateQueries());

  if (me.isLoading) return <TaiDang />;
  if (me.error instanceof ApiError && me.error.status === 401) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-subtle p-4">
        <div className="card w-full max-w-sm p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
            <Icon ten="lop" cls="h-6 w-6" />
          </div>
          <h1 className="mb-1 text-xl font-bold">Phân tích tồn kho 3T</h1>
          <p className="mb-6 text-sm text-ink-soft">Đắp chiếu · Cảnh báo thiếu hàng · Thu hồi DVBH</p>
          <a className="btn-primary w-full justify-center py-2" href="/api/auth/login">
            Đăng nhập với Google
          </a>
        </div>
      </div>
    );
  }
  const u = me.data;
  if (!u || u.trang_thai !== "da_duyet") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-subtle p-4">
        <div className="card w-full max-w-sm text-center text-sm">
          {u?.trang_thai === "khoa" ? "Tài khoản đã bị khoá." : `Tài khoản ${u?.email ?? ""} đang chờ Admin duyệt.`}
          <div className="mt-3">
            <button className="btn" onClick={dangXuat}>
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }
  const nhom = NHOM.map((g) => ({ ...g, ds: g.ds.filter((t) => !t.vaiTro || t.vaiTro.includes(u.vai_tro)) })).filter((g) => g.ds.length);
  const tatCa = nhom.flatMap((g) => g.ds);
  const hienTai = tatCa.some((t) => t.k === trang) ? trang : "tong-quan";
  const coTheGhi = u.vai_tro !== "xem";

  const sidebar = (
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-white transition-transform md:static md:translate-x-0 ${moMenu ? "translate-x-0" : "-translate-x-full"}`}>
      <a href="#/tong-quan" className="flex h-16 items-center gap-2.5 border-b border-line px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
          <Icon ten="lop" cls="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-bold leading-tight">Tồn kho 3T</span>
          <span className="block text-[11px] text-ink-soft">Phân tích & cảnh báo</span>
        </span>
      </a>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {nhom.map((g) => (
          <div key={g.t || "goc"}>
            {g.t && <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft/80">{g.t}</div>}
            <div className="space-y-0.5">
              {g.ds.map((t) => (
                <a key={t.k} href={`#/${t.k}`} className={`nav-item ${hienTai === t.k ? "active" : ""}`}>
                  <Icon ten={t.icon} />
                  {t.t}
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
            {(u.ten || u.email)[0].toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{u.ten || u.email}</div>
            <div className="text-xs text-ink-soft">{TEN_VAI_TRO[u.vai_tro]}</div>
          </div>
          <button className="btn btn-sm" onClick={dangXuat} title="Đăng xuất" aria-label="Đăng xuất">
            <Icon ten="dang-xuat" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <ChiTietLkProvider>
      <div className="flex min-h-screen bg-subtle/40">
        {sidebar}
        {moMenu && <div className="fixed inset-0 z-30 bg-slate-900/30 md:hidden" onClick={() => setMoMenu(false)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <ThanhTren moMenu={() => setMoMenu(true)} tieuDe={tatCa.find((t) => t.k === hienTai)?.t ?? ""} />
          <main className="min-w-0 flex-1 p-4 md:p-6">
            <Suspense fallback={<TaiDang />}>
              {hienTai === "tong-quan" && <TongQuan />}
              {hienTai === "dap-chieu" && <DapChieu />}
              {hienTai === "t5" && <DapChieu t5 />}
              {hienTai === "leadtime" && <Leadtime />}
              {hienTai === "thu-hoi" && <ThuHoi />}
              {hienTai === "nhap-du-lieu" && <ImportDuLieu laAdmin={u.vai_tro === "admin"} />}
              {hienTai.startsWith("cai-dat/") && <CaiDat tab={hienTai.slice(8)} coTheGhi={coTheGhi} />}
              {hienTai === "quan-tri/nguoi-dung" && <NguoiDung toi={u.email} />}
              {hienTai === "quan-tri/du-lieu" && <QuanTriDuLieu />}
              {hienTai === "quan-tri/nhat-ky" && <NhatKy />}
            </Suspense>
          </main>
        </div>
      </div>
    </ChiTietLkProvider>
  );
}

// Thanh tren: nut menu (mobile) + moc du lieu dang dung cho moi bao cao.
function ThanhTren({ moMenu, tieuDe }: { moMenu: () => void; tieuDe: string }) {
  const moc = useQuery({ queryKey: ["moc"], queryFn: () => api<Moc>("/bao-cao/moc-du-lieu") });
  const m = moc.data;
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur md:px-6">
      <button className="btn btn-sm md:hidden" onClick={moMenu} aria-label="Mở menu">
        <Icon ten="menu" />
      </button>
      <span className="text-sm font-semibold md:hidden">{tieuDe}</span>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-xs">
        <span className="chip" title="Phiên tồn kho dùng cho mọi báo cáo">
          <span className={`h-1.5 w-1.5 rounded-full ${m?.ton_kho ? "bg-success" : "bg-warning"}`} />
          Tồn kho: {m?.ton_kho?.xong_luc?.slice(0, 16) ?? "chưa có"}
        </span>
        <span className="chip hidden sm:inline-flex" title="Ngày phát sinh mới nhất trong sổ chi tiết vật tư">
          <span className={`h-1.5 w-1.5 rounded-full ${m?.so_chi_tiet.den ? "bg-success" : "bg-warning"}`} />
          Sổ chi tiết đến: {m?.so_chi_tiet.den ?? "chưa có"}
        </span>
      </div>
    </header>
  );
}
