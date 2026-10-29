import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Bang, Chon, Loi, TaiDang, TieuDe, type Cot } from "../components/ui";

interface Dong { luc: string; nguoi: string | null; hanh_dong: string; chi_tiet: string | null; loai: "thao_tac" | "import" }

export default function NhatKy() {
  const q = useQuery({ queryKey: ["nhat-ky"], queryFn: () => api<{ rows: Dong[] }>("/quan-tri/nhat-ky") });
  const [loai, setLoai] = useState<"" | "thao_tac" | "import">("");
  if (q.isLoading) return <TaiDang />;
  if (q.error) return <Loi loi={q.error} />;
  const rows = q.data!.rows.filter((r) => !loai || r.loai === loai);
  const cot: Cot<Dong>[] = [
    { ten: "Lúc", the: "phu" as const, lay: (r) => r.luc, sx: (r) => r.luc },
    { ten: "Người", the: "phu" as const, lay: (r) => r.nguoi, sx: (r) => r.nguoi },
    { ten: "Loại", the: "nhan" as const, lay: (r) => <span className={`badge ${r.loai === "import" ? "bg-primary-soft text-primary" : "bg-slate-100 text-slate-700"}`}>{r.loai === "import" ? "Import" : "Thao tác"}</span> },
    { ten: "Hành động", the: "tieu_de" as const, lay: (r) => <span className="font-medium">{r.hanh_dong}</span>, sx: (r) => r.hanh_dong },
    { ten: "Chi tiết", lay: (r) => <span className="inline-block max-w-[520px] truncate align-bottom text-xs text-ink-soft" title={r.chi_tiet ?? ""}>{r.chi_tiet}</span> },
  ];
  return (
    <div>
      <TieuDe ten="Nhật ký" moTa="300 thao tác gần nhất: import dữ liệu, sửa cài đặt, quản lý người dùng, dọn dữ liệu." />
      <div className="mb-3">
        <Chon nhan="Loại" giaTri={loai} dat={setLoai} luaChon={[{ v: "", t: "Tất cả" }, { v: "thao_tac", t: "Thao tác" }, { v: "import", t: "Import" }]} />
      </div>
      <Bang rows={rows} cot={cot} timTheo={(r) => `${r.nguoi} ${r.hanh_dong} ${r.chi_tiet}`} />
    </div>
  );
}
