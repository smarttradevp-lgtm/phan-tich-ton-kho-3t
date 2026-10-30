import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./lib/api";
import { Icon, TaiDang, type IconTen } from "./components/ui";
import { HoSoLkProvider } from "./components/HoSoLinhKien";
import { khoiPhucLoc, trangHienTai } from "./lib/dieuHuong";

const TongQuan = lazy(() => import("./pages/TongQuan"));
const DapChieu = lazy(() => import("./pages/DapChieu"));
const Leadtime = lazy(() => import("./pages/Leadtime"));
const ThuHoi = lazy(() => import("./pages/ThuHoi"));
const ImportDuLieu = lazy(() => import("./pages/ImportDuLieu"));
const CaiDat = lazy(() => import("./pages/CaiDat"));
const NguoiDung = lazy(() => import("./pages/NguoiDung"));
const QuanTriDuLieu = lazy(() => import("./pages/QuanTriDuLieu"));
const NhatKy = lazy(() => import("./pages/NhatKy"));
const KhoMisa = lazy(() => import("./pages/KhoMisa"));

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
      { k: "quan-tri/kho-misa", t: "Kho dữ liệu MISA", icon: "lop", vaiTro: ["admin"] },
      { k: "quan-tri/nhat-ky", t: "Nhật ký", icon: "nhat-ky", vaiTro: ["admin"] },
    ],
  },
];
const TEN_VAI_TRO: Record<VaiTro, string> = { admin: "Admin", nhap_lieu: "Nhập liệu", xem: "Chỉ xem" };

const docHash = () => {
  khoiPhucLoc();
  return trangHienTai();
};

export default function App() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me"), retry: false });
  const [trang, setTrang] = useState(docHash);
  // "Xoá lọc" -> tang phien ban de dung lai trang voi bo loc mac dinh.
  const [phienBan, setPhienBan] = useState(0);
  useEffect(() => {
    const f = () => setPhienBan((v) => v + 1);
    addEventListener("xoa-loc", f);
    return () => removeEventListener("xoa-loc", f);
  }, []);
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
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] md:w-60 flex-col border-r border-line bg-white transition-transform md:static md:translate-x-0 ${moMenu ? "translate-x-0" : "-translate-x-full"}`}>
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
    <HoSoLkProvider>
      <div className="flex min-h-screen bg-subtle/40">
        {sidebar}
        {moMenu && <div className="fixed inset-0 z-40 bg-slate-900/30 md:hidden" onClick={() => setMoMenu(false)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <ThanhTren moMenu={() => setMoMenu(true)} tieuDe={tatCa.find((t) => t.k === hienTai)?.t ?? ""} />
          <main className="min-w-0 flex-1 px-3 pb-24 pt-4 md:p-6">
            <Suspense key={`${hienTai}-${phienBan}`} fallback={<TaiDang />}>
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
              {hienTai === "quan-tri/kho-misa" && <KhoMisa />}
            </Suspense>
          </main>
        </div>
        <ThanhDuoi hienTai={hienTai} moMenu={() => setMoMenu(true)} />
      </div>
    </HoSoLkProvider>
  );
}

// Thanh tren: nut menu (mobile) + moc du lieu dang dung cho moi bao cao.
// "2026-10-29 08:00:00" -> "29/10 08:00" tren mobile, day du tren desktop.
function TgGon({ luc }: { luc: string }) {
  return (
    <>
      <span className="sm:hidden">{`${luc.slice(8, 10)}/${luc.slice(5, 7)} ${luc.slice(11, 16)}`}</span>
      <span className="hidden sm:inline">{luc.slice(0, 16)}</span>
    </>
  );
}

// Thanh dieu huong duoi day (chi mobile): 4 bao cao chinh + "Thêm" mo menu day du.
const DUOI: { k: string; t: string; icon: IconTen }[] = [
  { k: "tong-quan", t: "Tổng quan", icon: "tong-quan" },
  { k: "dap-chieu", t: "Đắp chiếu", icon: "dap-chieu" },
  { k: "t5", t: "T5", icon: "canh-bao" },
  { k: "leadtime", t: "Leadtime", icon: "dong-ho" },
];

function ThanhDuoi({ hienTai, moMenu }: { hienTai: string; moMenu: () => void }) {
  const trongDuoi = DUOI.some((d) => d.k === hienTai);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {DUOI.map((d) => (
        <a key={d.k} href={`#/${d.k}`} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${hienTai === d.k ? "font-semibold text-primary" : "text-ink-soft"}`}>
          <Icon ten={d.icon} cls="h-5 w-5" />
          {d.t}
        </a>
      ))}
      <button className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${trongDuoi ? "text-ink-soft" : "font-semibold text-primary"}`} onClick={moMenu}>
        <Icon ten="menu" cls="h-5 w-5" />
        Thêm
      </button>
    </nav>
  );
}

function ThanhTren({ moMenu, tieuDe }: { moMenu: () => void; tieuDe: string }) {
  const moc = useQuery({ queryKey: ["moc"], queryFn: () => api<Moc>("/bao-cao/moc-du-lieu") });
  const m = moc.data;
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-white/95 px-3 backdrop-blur md:h-16 md:gap-3 md:px-6">
      <button className="btn btn-sm md:hidden" onClick={moMenu} aria-label="Mở menu">
        <Icon ten="menu" />
      </button>
      <span className="min-w-0 truncate text-sm font-semibold md:hidden">{tieuDe}</span>
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs">
        <span className="chip" title="Phiên tồn kho dùng cho mọi báo cáo">
          <span className={`h-1.5 w-1.5 rounded-full ${m?.ton_kho ? "bg-success" : "bg-warning"}`} />
          <span className="hidden sm:inline">Tồn kho:</span>
          <span className="sm:hidden">Tồn</span> {m?.ton_kho?.xong_luc ? <TgGon luc={m.ton_kho.xong_luc} /> : "chưa có"}
        </span>
        <span className="chip hidden sm:inline-flex" title="Ngày phát sinh mới nhất trong sổ chi tiết vật tư">
          <span className={`h-1.5 w-1.5 rounded-full ${m?.so_chi_tiet.den ? "bg-success" : "bg-warning"}`} />
          Sổ chi tiết đến: {m?.so_chi_tiet.den ?? "chưa có"}
        </span>
      </div>
    </header>
  );
}
