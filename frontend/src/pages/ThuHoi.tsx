import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtSo } from "../lib/api";
import { taiExcel } from "../lib/excel";
import { Bang, ChonGiaTri, duyNhat, Loi, TaiDang, TieuDe, type Cot } from "../components/ui";
import { useMoLk } from "../components/ChiTietLk";

interface Dong {
  kho: string; ma_kho: string; ma: string; ten: string; xuat: number | null; ton: number; lam_viec: boolean; phan_loai: string; he_so: number;
  ton_chuan: number; nhom: string; danh_gia: string; phong_ban: string; khu_vuc: string; kho_chua_khai_bao: boolean;
}
interface Kq { ky_tu_ngay: string | null; ky_den_ngay: string | null; so_ky_2_tuan: number; moc_ton_kho: string | null; rows: Dong[] }

const NHOM = ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"];
const DINH_NGHIA = [
  ["Nhóm 1", "Đã nghỉ hoặc tạm nghỉ", "Yêu cầu thu hồi toàn bộ"],
  ["Nhóm 2", "Có số dư, không xuất trong kỳ", "Xem xét thu hồi toàn bộ"],
  ["Nhóm 3", "Có số dư, tồn trên chuẩn 2 tuần", "Điều chỉnh về mức tồn chuẩn"],
  ["Nhóm 4", "Còn lại", "Không xử lý"],
];

export default function ThuHoi() {
  const moLk = useMoLk();
  const q = useQuery({ queryKey: ["thu-hoi"], queryFn: () => api<Kq>("/bao-cao/thu-hoi") });
  const [pb, setPb] = useState("");
  const [kv, setKv] = useState("");
  const [chon, setChon] = useState<{ pl?: string; nhom?: string }>({});
  const rows = q.data?.rows ?? [];
  const loc = useMemo(() => rows.filter((r) => (!pb || r.phong_ban === pb) && (!kv || r.khu_vuc === kv)), [rows, pb, kv]);
  const maTran = useMemo(() => {
    const m = new Map<string, { he_so: number; danh_gia: Map<string, string>; nhom: Record<string, number> }>();
    for (const r of loc) {
      const g = m.get(r.phan_loai) ?? { he_so: r.he_so, danh_gia: new Map(), nhom: Object.fromEntries(NHOM.map((n) => [n, 0])) };
      g.nhom[r.nhom] += r.ton;
      if (r.danh_gia) g.danh_gia.set(r.nhom, r.danh_gia);
      m.set(r.phan_loai, g);
    }
    return [...m.entries()].sort((a, b) => sum(b[1].nhom) - sum(a[1].nhom));
  }, [loc]);
  const chiTiet = loc.filter((r) => (!chon.pl || r.phan_loai === chon.pl) && (!chon.nhom || r.nhom === chon.nhom));
  const khoChuaKb = duyNhat(rows.filter((r) => r.kho_chua_khai_bao).map((r) => r.kho));

  const cot: Cot<Dong>[] = [
    { ten: "Kho KTV", lay: (r) => r.kho, sx: (r) => r.kho },
    { ten: "Phòng ban", lay: (r) => r.phong_ban },
    { ten: "Khu vực", lay: (r) => r.khu_vuc, sx: (r) => r.khu_vuc },
    { ten: "Làm việc", lay: (r) => (r.lam_viec ? "Làm" : <span className="text-danger">Nghỉ</span>) },
    { ten: "Mã", lay: (r) => r.ma, cls: "font-mono text-xs text-primary", sx: (r) => r.ma },
    { ten: "Tên hàng", lay: (r) => <span title={r.ten} className="inline-block max-w-[240px] truncate align-bottom">{r.ten}</span> },
    { ten: "Xuất trong kỳ", lay: (r) => fmtSo(r.xuat ?? 0, 2), so: true, sx: (r) => r.xuat ?? 0 },
    { ten: "Tồn", lay: (r) => fmtSo(r.ton, 2), so: true, sx: (r) => r.ton },
    { ten: "Phân loại", lay: (r) => r.phan_loai },
    { ten: "Hệ số", lay: (r) => fmtSo(r.he_so, 2), so: true },
    { ten: "Tồn chuẩn", lay: (r) => fmtSo(r.ton_chuan), so: true, sx: (r) => r.ton_chuan },
    { ten: "Nhóm", lay: (r) => r.nhom, sx: (r) => r.nhom },
    { ten: "Đánh giá", lay: (r) => r.danh_gia },
  ];

  return (
    <div>
      <TieuDe
        ten="Phân loại tồn kho DVBH theo linh kiện cần thu hồi"
        moTa={
          q.data && (
            <>
              Tồn kho KTV cập nhật {q.data.moc_ton_kho ?? "chưa có"} · Kỳ xuất {q.data.ky_tu_ngay ?? "?"} → {q.data.ky_den_ngay ?? "?"} (≈ {fmtSo(q.data.so_ky_2_tuan, 1)} kỳ 2 tuần)
            </>
          )
        }
        phai={
          <button
            className="btn"
            disabled={!chiTiet.length}
            onClick={() =>
              taiExcel(
                "thu-hoi-dvbh.xlsx",
                cot.map((c) => c.ten),
                chiTiet.map((r) => [r.kho, r.phong_ban, r.khu_vuc, r.lam_viec ? "Làm" : "Nghỉ", r.ma, r.ten, r.xuat ?? 0, r.ton, r.phan_loai, r.he_so, r.ton_chuan, r.nhom, r.danh_gia]),
              )
            }
          >
            ⬇ Tải Excel
          </button>
        }
      />
      <div className="mb-3 grid gap-2 md:grid-cols-4">
        {DINH_NGHIA.map(([n, d, h]) => (
          <div key={n} className="card py-2 text-xs">
            <b>{n}</b>: {d} → <i>{h}</i>
          </div>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <ChonGiaTri nhan="Bộ phận" giaTri={pb} dat={setPb} ds={duyNhat(rows.map((r) => r.phong_ban))} />
        <ChonGiaTri nhan="Khu vực" giaTri={kv} dat={setKv} ds={duyNhat(rows.filter((r) => !pb || r.phong_ban === pb).map((r) => r.khu_vuc))} />
      </div>
      {q.isLoading ? (
        <TaiDang />
      ) : q.error ? (
        <Loi loi={q.error} />
      ) : (
        <>
          <div className="mb-4 overflow-auto rounded-xl border border-line">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Phân loại linh kiện</th>
                  <th className="so">Hệ số</th>
                  <th className="so">Tổng SL</th>
                  {NHOM.map((n) => (
                    <th key={n} className="so">{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-primary-soft font-semibold">
                  <td>TỔNG</td>
                  <td />
                  <td className="so">{fmtSo(loc.reduce((a, r) => a + r.ton, 0), 2)}</td>
                  {NHOM.map((n) => (
                    <td key={n} className="so">{fmtSo(loc.filter((r) => r.nhom === n).reduce((a, r) => a + r.ton, 0), 2)}</td>
                  ))}
                </tr>
                {maTran.map(([pl, g]) => (
                  <tr key={pl}>
                    <td>
                      <button className="text-left hover:underline" onClick={() => setChon({ pl })}>{pl}</button>
                    </td>
                    <td className="so">{fmtSo(g.he_so, 2)}</td>
                    <td className="so">{fmtSo(sum(g.nhom), 2)}</td>
                    {NHOM.map((n) => (
                      <td key={n} className="so">
                        <button className="hover:underline" title={g.danh_gia.get(n)} onClick={() => setChon({ pl, nhom: n })}>{fmtSo(g.nhom[n], 2)}</button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {khoChuaKb.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              {khoChuaKb.length} kho KTV chưa khai báo phòng ban / trạng thái làm việc (vẫn tính, coi như đang làm). Khai báo ở Cài đặt › Kho.
            </div>
          )}
          <div className="mb-2 flex items-center gap-2 text-sm">
            <b>Chi tiết</b>
            {(chon.pl || chon.nhom) && (
              <>
                <span className="text-ink-soft">{[chon.pl, chon.nhom].filter(Boolean).join(" · ")}</span>
                <button className="btn" onClick={() => setChon({})}>✕ Bỏ lọc</button>
              </>
            )}
          </div>
          <Bang rows={chiTiet} cot={cot} timTheo={(r) => `${r.ma} ${r.ten} ${r.kho}`} onClick={(r) => moLk(r.ma)} />
        </>
      )}
    </div>
  );
}

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
