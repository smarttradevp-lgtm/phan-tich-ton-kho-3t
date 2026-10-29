import { useQuery } from "@tanstack/react-query";
import { api, fmtSo } from "../lib/api";
import { O, TieuDe } from "../components/ui";
import type { DapChieuKq } from "./DapChieu";

interface Moc {
  ton_kho: { phien_ban: string; xong_luc: string; ky_tu_ngay: string | null; ky_den_ngay: string | null } | null;
  so_chi_tiet: { tu: string | null; den: string | null; n: number };
  xuat_thang_tinh: { tu: string | null; den: string | null; so_thang: number };
  linh_kien: { n: number; luc: string | null };
}

export default function TongQuan({ moTrang }: { moTrang: (t: string) => void }) {
  const moc = useQuery({ queryKey: ["moc"], queryFn: () => api<Moc>("/bao-cao/moc-du-lieu") });
  const dc = useQuery({ queryKey: ["dap-chieu", "gop_rieng_ktv"], queryFn: () => api<DapChieuKq>("/bao-cao/dap-chieu?che_do=gop_rieng_ktv") });
  const rows = dc.data?.rows ?? [];
  const t5 = rows.filter((r) => r.xep_loai === "T5" && r.phan_loai !== "Thuộc diện cắt mã");
  const giaTri = rows.reduce((a, r) => a + (r.gia_tri_ton ?? 0), 0);
  const tonDu = rows.filter((r) => r.xep_loai === "T4").reduce((a, r) => a + (r.gia_tri_ton_du ?? 0), 0);
  const m = moc.data;
  return (
    <div>
      <TieuDe ten="Tổng quan tồn kho 3T" />
      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <O nhan="Giá trị tồn kho" so={fmtSo(giaTri)} phu="Theo giá nhập (tạm dùng giá dự phòng nếu chưa có)" />
        <button className="text-left" onClick={() => moTrang("t5")}>
          <O nhan="Mã nguy cơ thiếu (T5)" so={fmtSo(t5.length)} mau="danger" phu="Đã loại LK cắt mã — bấm để xem" />
        </button>
        <O nhan="Giá trị tồn vượt chuẩn (T4)" so={fmtSo(tonDu)} mau="warning" phu="Phần tồn dư của mã T4" />
        <O nhan="Số mã đang theo dõi" so={fmtSo(rows.length)} phu="Gộp kho công ty + Kho KTV chung" />
      </div>
      <h2 className="mb-2 font-semibold">Mốc dữ liệu</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <O nhan="Tồn kho (từ linh-kien-app)" so={m?.ton_kho?.xong_luc ?? "Chưa đồng bộ"} phu={m?.ton_kho ? `Phiên bản ${m.ton_kho.phien_ban} · Kỳ ${m.ton_kho.ky_tu_ngay ?? "?"} → ${m.ton_kho.ky_den_ngay ?? "?"}` : "Kiểm tra Nhập & đồng bộ"} />
        <O nhan="Sổ chi tiết vật tư" so={m?.so_chi_tiet.den ?? "Chưa import"} phu={m?.so_chi_tiet.n ? `${fmtSo(m.so_chi_tiet.n)} dòng, từ ${m.so_chi_tiet.tu}` : "Import hằng ngày ở Nhập & đồng bộ"} />
        <O nhan="Xuất tháng tĩnh" so={m?.xuat_thang_tinh.so_thang ? `${m.xuat_thang_tinh.so_thang} tháng` : "Chưa có"} phu={m?.xuat_thang_tinh.tu ? `${m.xuat_thang_tinh.tu} → ${m.xuat_thang_tinh.den}` : undefined} />
        <O nhan="Danh mục linh kiện" so={fmtSo(m?.linh_kien.n ?? 0)} phu={m?.linh_kien.luc ? `Đồng bộ ${m.linh_kien.luc}` : "Chưa đồng bộ"} />
      </div>
    </div>
  );
}
