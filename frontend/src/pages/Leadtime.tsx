import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtSo } from "../lib/api";
import { taiExcel } from "../lib/excel";
import { Bang, Chon, ChonGiaTri, duyNhat, Loi, NhanCanhBao, TaiDang, TieuDe, type Cot } from "../components/ui";
import { useMoLk } from "../components/ChiTietLk";

interface Dong {
  kho: string; ma_kho: string | null; ma: string; ten: string; tieu_hao: [number, number, number]; ton: number;
  so_ngay_du: (number | null)[]; canh_bao: [string, string, string]; tb_ngay: number; ton_chuan: number; sl_thieu_can_dat: number;
  tan_suat: string; he_so_nk: number; leadtime: number; hang_dang_ve: number; phan_loai: string; dvbh_so_ca: number;
}
interface Kq { ngay_moc: string | null; cua_so: [number, number, number]; moc_ton_kho: string | null; rows: Dong[] }

const MUC = ["1. Thiếu hàng nghiêm trọng", "2. Thiếu hàng", "3. Tới thời điểm đặt hàng", "4. Bình thường", "5. Hết tồn - không tiêu hao", "6. Còn tồn - không tiêu hao"];

export default function Leadtime() {
  const [loaiKho, setLoaiKho] = useState<"cong_ty" | "ktv" | "tat_ca">("cong_ty");
  const [gop, setGop] = useState(false);
  const [cuaSo, setCuaSo] = useState<"0" | "1" | "2">("0");
  const [muc, setMuc] = useState("");
  const [kho, setKho] = useState("");
  const [tanSuat, setTanSuat] = useState("");
  const moLk = useMoLk();
  const q = useQuery({ queryKey: ["leadtime", loaiKho, gop], queryFn: () => api<Kq>(`/bao-cao/leadtime?loai_kho=${loaiKho}&gop=${gop ? 1 : 0}`) });
  const rows = q.data?.rows ?? [];
  const cs = q.data?.cua_so ?? [7, 14, 30];
  const i = Number(cuaSo);

  const tomTat = useMemo(() => {
    const dsKho = duyNhat(rows.map((r) => r.kho));
    return dsKho.flatMap((k) =>
      cs.map((d, j) => ({ kho: k, d, dem: MUC.map((m) => rows.filter((r) => r.kho === k && r.canh_bao[j].toLowerCase() === m.toLowerCase()).length) })),
    );
  }, [rows, cs]);

  const loc = useMemo(
    () => rows.filter((r) => (!kho || r.kho === kho) && (!tanSuat || r.tan_suat === tanSuat) && (!muc || r.canh_bao[i].toLowerCase() === muc.toLowerCase())),
    [rows, kho, tanSuat, muc, i],
  );

  const cot: Cot<Dong>[] = [
    { ten: "Mã", lay: (r) => r.ma, cls: "font-mono text-xs text-primary", sx: (r) => r.ma },
    { ten: "Tên sản phẩm", lay: (r) => <span title={r.ten} className="inline-block max-w-[240px] truncate align-bottom">{r.ten}</span> },
    { ten: "Kho", lay: (r) => r.kho, sx: (r) => r.kho },
    { ten: `TH ${cs[0]} ngày`, lay: (r) => fmtSo(r.tieu_hao[0], 2), so: true, sx: (r) => r.tieu_hao[0] },
    { ten: `TH ${cs[1]} ngày`, lay: (r) => fmtSo(r.tieu_hao[1], 2), so: true, sx: (r) => r.tieu_hao[1] },
    { ten: `TH ${cs[2]} ngày`, lay: (r) => fmtSo(r.tieu_hao[2], 2), so: true, sx: (r) => r.tieu_hao[2] },
    { ten: "Tồn", lay: (r) => fmtSo(r.ton, 2), so: true, sx: (r) => r.ton },
    { ten: "Phân loại", lay: (r) => r.phan_loai, sx: (r) => r.phan_loai },
    { ten: `Cảnh báo ${cs[0]}N`, lay: (r) => <NhanCanhBao v={r.canh_bao[0]} /> },
    { ten: `Cảnh báo ${cs[1]}N`, lay: (r) => <NhanCanhBao v={r.canh_bao[1]} /> },
    { ten: `Cảnh báo ${cs[2]}N`, lay: (r) => <NhanCanhBao v={r.canh_bao[2]} /> },
    { ten: "Số ngày dư", lay: (r) => fmtSo(r.so_ngay_du[i], 1), so: true, sx: (r) => r.so_ngay_du[i] },
    { ten: "TB tiêu hao/ngày", lay: (r) => fmtSo(r.tb_ngay, 2), so: true, sx: (r) => r.tb_ngay },
    { ten: "Tồn chuẩn", lay: (r) => fmtSo(r.ton_chuan, 1), so: true, sx: (r) => r.ton_chuan },
    { ten: "Đang về", lay: (r) => fmtSo(r.hang_dang_ve || null), so: true },
    { ten: "SL thiếu cần đặt", lay: (r) => <span className={r.sl_thieu_can_dat > 0 ? "font-semibold text-danger" : ""}>{fmtSo(r.sl_thieu_can_dat, 1)}</span>, so: true, sx: (r) => r.sl_thieu_can_dat },
    { ten: "Tần suất", lay: (r) => r.tan_suat },
    { ten: "Hệ số NK", lay: (r) => fmtSo(r.he_so_nk, 2), so: true },
    { ten: "Leadtime", lay: (r) => fmtSo(r.leadtime), so: true },
    { ten: "DVBH báo thiếu", lay: (r) => (r.dvbh_so_ca ? `${r.dvbh_so_ca} ca` : ""), so: true },
  ];

  return (
    <div>
      <TieuDe
        ten="Cảnh báo thiếu hàng theo leadtime"
        moTa={q.data && <>Tiêu hao tính tới {q.data.ngay_moc ?? "— (chưa import sổ chi tiết)"} · Tồn kho cập nhật {q.data.moc_ton_kho ?? "chưa có"}</>}
        phai={
          <button
            className="btn"
            disabled={!loc.length}
            onClick={() =>
              taiExcel(
                `canh-bao-leadtime-${q.data?.ngay_moc}.xlsx`,
                cot.map((c) => c.ten),
                loc.map((r) => [r.ma, r.ten, r.kho, ...r.tieu_hao, r.ton, r.phan_loai, ...r.canh_bao, r.so_ngay_du[i], r.tb_ngay, r.ton_chuan, r.hang_dang_ve, r.sl_thieu_can_dat, r.tan_suat, r.he_so_nk, r.leadtime, r.dvbh_so_ca]),
              )
            }
          >
            ⬇ Tải Excel
          </button>
        }
      />
      <div className="mb-3 flex flex-wrap gap-3">
        <Chon nhan="Loại kho" giaTri={loaiKho} dat={setLoaiKho} luaChon={[{ v: "cong_ty", t: "Kho công ty" }, { v: "ktv", t: "Kho KTV" }, { v: "tat_ca", t: "Tất cả" }]} />
        <Chon nhan="Gộp" giaTri={gop ? "1" : "0"} dat={(v) => setGop(v === "1")} luaChon={[{ v: "0", t: "Theo từng kho" }, { v: "1", t: "Gộp chung" }]} />
      </div>
      {q.isLoading ? (
        <TaiDang />
      ) : q.error ? (
        <Loi loi={q.error} />
      ) : (
        <>
          <div className="mb-4 max-h-80 overflow-auto rounded-xl border border-line">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Kho</th>
                  <th>Căn cứ tiêu hao</th>
                  {MUC.map((m) => (
                    <th key={m} className="so">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tomTat.map((t) => (
                  <tr key={`${t.kho}-${t.d}`}>
                    <td>{t.kho}</td>
                    <td>{t.d} ngày</td>
                    {t.dem.map((n, j) => (
                      <td key={j} className={`so ${j < 2 && n ? "font-semibold text-danger" : ""}`}>
                        <button className="hover:underline" title="Lọc danh sách theo ô này" onClick={() => (setKho(gop ? "" : t.kho), setCuaSo(String(cs.indexOf(t.d)) as "0" | "1" | "2"), setMuc(MUC[j]))}>
                          {fmtSo(n)}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mb-3 flex flex-wrap gap-3">
            <ChonGiaTri nhan="Kho" giaTri={kho} dat={setKho} ds={duyNhat(rows.map((r) => r.kho))} />
            <Chon nhan="Cửa sổ" giaTri={cuaSo} dat={setCuaSo} luaChon={cs.map((d, j) => ({ v: String(j) as "0" | "1" | "2", t: `${d} ngày` }))} />
            <ChonGiaTri nhan="Mức cảnh báo" giaTri={muc} dat={setMuc} ds={MUC} />
            <ChonGiaTri nhan="Tần suất" giaTri={tanSuat} dat={setTanSuat} ds={["Tiêu nhiều", "Tiêu đều", "Khác (còn lại)", "Ít tiêu hao"]} />
          </div>
          <Bang rows={loc} cot={cot} timTheo={(r) => `${r.ma} ${r.ten}`} onClick={(r) => moLk(r.ma)} />
          <p className="mt-2 text-xs text-ink-soft">
            Số ngày dư = Tồn / (Tiêu hao / số ngày) − số ngày cửa sổ − Leadtime · &lt; −3 thiếu nghiêm trọng · &lt; 0 thiếu · ≤ 2 tới thời điểm đặt · Tồn chuẩn = TB tiêu hao/ngày × Hệ số NK × 30.
          </p>
        </>
      )}
    </div>
  );
}
