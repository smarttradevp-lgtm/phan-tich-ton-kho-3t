import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./lib/api";
import { TaiDang } from "./components/ui";

const TongQuan = lazy(() => import("./pages/TongQuan"));
const DapChieu = lazy(() => import("./pages/DapChieu"));
const Leadtime = lazy(() => import("./pages/Leadtime"));
const ThuHoi = lazy(() => import("./pages/ThuHoi"));
const ImportDuLieu = lazy(() => import("./pages/ImportDuLieu"));
const CaiDat = lazy(() => import("./pages/CaiDat"));
const NguoiDung = lazy(() => import("./pages/NguoiDung"));

interface Me { email: string; ten: string | null; vai_tro: "admin" | "nhap_lieu" | "xem"; trang_thai: string }

const TRANG = [
  { k: "tong-quan", t: "Tổng quan" },
  { k: "dap-chieu", t: "Đắp chiếu" },
  { k: "t5", t: "Cảnh báo T5" },
  { k: "leadtime", t: "Cảnh báo leadtime" },
  { k: "thu-hoi", t: "LK thu hồi DVBH" },
  { k: "import", t: "Nhập & đồng bộ", vaiTro: ["admin", "nhap_lieu"] },
  { k: "cai-dat", t: "Cài đặt" },
  { k: "nguoi-dung", t: "Người dùng", vaiTro: ["admin"] },
];

const docHash = () => location.hash.replace(/^#\/?/, "") || "tong-quan";

export default function App() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me"), retry: false });
  const [trang, setTrang] = useState(docHash);
  useEffect(() => {
    const f = () => setTrang(docHash());
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  const moTrang = (k: string) => (location.hash = `/${k}`);

  if (me.isLoading) return <TaiDang />;
  if (me.error instanceof ApiError && me.error.status === 401) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-subtle">
        <div className="card w-96 text-center">
          <h1 className="mb-1 text-xl font-bold">Phân tích tồn kho 3T</h1>
          <p className="mb-4 text-sm text-ink-soft">Đăng nhập bằng tài khoản Google công ty</p>
          <a className="btn-primary" href="/api/auth/login">Đăng nhập với Google</a>
        </div>
      </div>
    );
  }
  const u = me.data;
  if (!u || u.trang_thai !== "da_duyet") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-subtle">
        <div className="card w-96 text-center text-sm">
          {u?.trang_thai === "khoa" ? "Tài khoản đã bị khoá." : `Tài khoản ${u?.email ?? ""} đang chờ Admin duyệt.`}
          <div className="mt-3">
            <button className="btn" onClick={() => api("/auth/logout", { method: "POST" }).then(() => qc.invalidateQueries())}>Đăng xuất</button>
          </div>
        </div>
      </div>
    );
  }
  const ds = TRANG.filter((t) => !t.vaiTro || t.vaiTro.includes(u.vai_tro));
  const hienTai = ds.some((t) => t.k === trang) ? trang : "tong-quan";
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-line bg-white p-3">
        <div className="mb-4 px-2 text-base font-bold text-primary">Tồn kho 3T</div>
        <nav className="space-y-0.5">
          {ds.map((t) => (
            <a key={t.k} href={`#/${t.k}`} className={`block rounded-lg px-2 py-1.5 text-sm ${hienTai === t.k ? "bg-primary-soft font-semibold text-primary" : "text-ink hover:bg-subtle"}`}>
              {t.t}
            </a>
          ))}
        </nav>
        <div className="mt-6 border-t border-line px-2 pt-3 text-xs text-ink-soft">
          <div className="truncate">{u.email}</div>
          <button className="mt-1 underline" onClick={() => api("/auth/logout", { method: "POST" }).then(() => qc.invalidateQueries())}>Đăng xuất</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5">
        <Suspense fallback={<TaiDang />}>
          {hienTai === "tong-quan" && <TongQuan moTrang={moTrang} />}
          {hienTai === "dap-chieu" && <DapChieu />}
          {hienTai === "t5" && <DapChieu t5 />}
          {hienTai === "leadtime" && <Leadtime />}
          {hienTai === "thu-hoi" && <ThuHoi />}
          {hienTai === "import" && <ImportDuLieu />}
          {hienTai === "cai-dat" && <CaiDat coTheGhi={u.vai_tro !== "xem"} />}
          {hienTai === "nguoi-dung" && <NguoiDung toi={u.email} />}
        </Suspense>
      </main>
    </div>
  );
}
