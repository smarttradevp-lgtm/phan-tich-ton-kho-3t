import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtSo } from "../lib/api";
import { taiExcel } from "../lib/excel";
import { Bang, Chon, ChonGiaTri, cotXuat, duyNhat, giaTriXuat, Loi, NhanCanhBao, TaiDang, TieuDe, useMobile, type Cot } from "../components/ui";
import { coLocTrang, useUrlState, xoaLocTrang } from "../lib/dieuHuong";
import { useMoLk } from "../components/HoSoLinhKien";

interface Dong {
  kho: string; ma_kho: string | null; ma: string; ten: string; tieu_hao: [number, number, number]; ton: number;
  so_ngay_du: (number | null)[]; canh_bao: [string, string, string]; tb_ngay: number; ton_chuan: number; sl_thieu_can_dat: number;
  tan_suat: string; he_so_nk: number; leadtime: number; hang_dang_ve: number; phan_loai: string; dvbh_so_ca: number;
  nhom_tuong_duong: string | null; doi_tac: string | null; du_tru: number | null; ton_du: number | null;
}
interface Kq { ngay_moc: string | null; cua_so: [number, number, number]; moc_ton_kho: string | null; rows: Dong[] }

const MUC = ["1. Thiếu hàng nghiêm trọng", "2. Thiếu hàng", "3. Tới thời điểm đặt hàng", "4. Bình thường", "5. Hết tồn - không tiêu hao", "6. Còn tồn - không tiêu hao"];

export default function Leadtime() {
  const [loaiKho, setLoaiKho] = useUrlState<"cong_ty" | "ktv" | "tat_ca">("loai_kho", "cong_ty");
  const [gop, setGop] = useUrlState("gop", false);
  const [cuaSo, setCuaSo] = useUrlState<"0" | "1" | "2">("cua_so", "0");
  const [muc, setMuc] = useUrlState("muc", "");
  const [kho, setKho] = useUrlState("kho", "");
  const [tanSuat, setTanSuat] = useUrlState("tan_suat", "");
  const [phanLoai, setPhanLoai] = useUrlState("phan_loai", "");
  const [daLoc, setDaLoc] = useState<Dong[]>([]);
  const moLk = useMoLk();
  const mobile = useMobile();
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

  const locTrang = useMemo(
    () =>
      rows.filter(
        (r) => (!kho || r.kho === kho) && (!tanSuat || r.tan_suat === tanSuat) && (!phanLoai || r.phan_loai === phanLoai) && (!muc || r.canh_bao[i].toLowerCase() === muc.toLowerCase()),
      ),
    [rows, kho, tanSuat, phanLoai, muc, i],
  );
  const loc = daLoc;

  const cot: Cot<Dong>[] = [
    { ten: "Mã", the: "phu", lay: (r) => r.ma, cls: "font-mono text-xs text-primary", sx: (r) => r.ma },
    { ten: "Nhóm tương đương", the: "an", lay: (r) => r.nhom_tuong_duong, gt: (r) => r.nhom_tuong_duong, loc: "gt" },
    { ten: "Tên sản phẩm", the: "tieu_de", lay: (r) => <span title={r.ten} className="inline-block max-w-[240px] truncate align-bottom">{r.ten}</span>, sx: (r) => r.ten },
    { ten: "Đối tác", the: "an", lay: (r) => r.doi_tac, gt: (r) => r.doi_tac, loc: "gt" },
    { ten: "Kho", the: "phu", lay: (r) => r.kho, sx: (r) => r.kho, loc: "gt" },
    ...cs.map((d, j) => ({ ten: `TH ${d} ngày`, the: (j === i ? undefined : "an") as Cot<Dong>["the"], lay: (r: Dong) => fmtSo(r.tieu_hao[j], 2), so: true, sx: (r: Dong) => r.tieu_hao[j], loc: "so" as const })),
    { ten: "Tồn", lay: (r) => fmtSo(r.ton, 2), so: true, sx: (r) => r.ton, loc: "so" },
    { ten: "Phân loại", the: "an", lay: (r) => r.phan_loai, sx: (r) => r.phan_loai, loc: "gt" },
    ...cs.map((d, j) => ({ ten: `Cảnh báo ${d}N`, the: (j === i ? "nhan" : "an") as Cot<Dong>["the"], lay: (r: Dong) => <NhanCanhBao v={r.canh_bao[j]} />, sx: (r: Dong) => r.canh_bao[j], loc: "gt" as const })),
    { ten: "Số ngày dư", lay: (r) => fmtSo(r.so_ngay_du[i], 1), so: true, sx: (r) => r.so_ngay_du[i], loc: "so" },
    { ten: "TB tiêu hao/ngày", the: "an", lay: (r) => fmtSo(r.tb_ngay, 2), so: true, sx: (r) => r.tb_ngay, loc: "so" },
    { ten: "Tồn chuẩn", lay: (r) => fmtSo(r.ton_chuan, 1), so: true, sx: (r) => r.ton_chuan, loc: "so" },
    { ten: "Đang về", the: "an", lay: (r) => fmtSo(r.hang_dang_ve || null), so: true, sx: (r) => r.hang_dang_ve, loc: "so" },
    { ten: "SL thiếu cần đặt", lay: (r) => <span className={r.sl_thieu_can_dat > 0 ? "font-semibold text-danger" : ""}>{fmtSo(r.sl_thieu_can_dat, 1)}</span>, so: true, sx: (r) => r.sl_thieu_can_dat, loc: "so" },
    { ten: "SL dự trữ tiêu chuẩn", the: "an", lay: (r) => fmtSo(r.du_tru), so: true, sx: (r) => r.du_tru, loc: "so" },
    { ten: "SL tồn dư ước tính", the: "an", lay: (r) => <span className={(r.ton_du ?? 0) < 0 ? "text-danger" : ""}>{fmtSo(r.ton_du, 2)}</span>, so: true, sx: (r) => r.ton_du, loc: "so" },
    { ten: "Tần suất", lay: (r) => r.tan_suat, sx: (r) => r.tan_suat, loc: "gt" },
    { ten: "Hệ số NK", the: "an", lay: (r) => fmtSo(r.he_so_nk, 2), so: true, sx: (r) => r.he_so_nk, loc: "so" },
    { ten: "Leadtime", the: "an", lay: (r) => fmtSo(r.leadtime), so: true, sx: (r) => r.leadtime, loc: "so" },
    { ten: "DVBH báo thiếu", the: "an", lay: (r) => (r.dvbh_so_ca ? `${r.dvbh_so_ca} ca` : ""), so: true, sx: (r) => r.dvbh_so_ca, loc: "so" },
  ];

  return (
    <div>
      <TieuDe
        ten="Cảnh báo thiếu hàng theo leadtime"
        moTa={q.data && <>Tiêu hao tính tới {q.data.ngay_moc ?? "— (chưa import sổ chi tiết)"} · Tồn kho cập nhật {q.data.moc_ton_kho ?? "chưa có"}</>}
        phai={
          <>
          {coLocTrang() && (
            <button className="btn" onClick={xoaLocTrang}>
              ✕ Xoá lọc
            </button>
          )}
          <button
            className="btn"
            disabled={!loc.length}
            onClick={() =>
              taiExcel(
                `canh-bao-leadtime-${q.data?.ngay_moc}.xlsx`,
                cotXuat(cot).map((c) => c.ten),
                loc.map((r) => cotXuat(cot).map((c) => giaTriXuat(c, r))),
              )
            }
          >
            ⬇ Tải Excel ({loc.length.toLocaleString("vi-VN")} dòng)
          </button>
          </>
        }
      />
      <div className="loc-bar">
        <Chon nhan="Loại kho" giaTri={loaiKho} dat={setLoaiKho} luaChon={[{ v: "cong_ty", t: "Kho công ty" }, { v: "ktv", t: "Kho KTV" }, { v: "tat_ca", t: "Tất cả" }]} />
        <Chon nhan="Gộp" giaTri={gop ? "1" : "0"} dat={(v) => setGop(v === "1")} luaChon={[{ v: "0", t: "Theo từng kho" }, { v: "1", t: "Gộp chung" }]} />
      </div>
      {q.isLoading ? (
        <TaiDang />
      ) : q.error ? (
        <Loi loi={q.error} />
      ) : (
        <>
          {mobile && (
            <div className="mb-4 space-y-2">
              <p className="text-xs text-ink-soft">Tổng hợp theo cửa sổ {cs[i]} ngày (đổi ở ô “Cửa sổ” bên dưới). Bấm số để lọc.</p>
              {tomTat
                .filter((t) => t.d === cs[i])
                .map((t) => (
                  <div key={t.kho} className="card p-3">
                    <div className="mb-2 truncate text-sm font-semibold">{t.kho}</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {t.dem.map((n, j) => (
                        <button
                          key={j}
                          className={`rounded-lg px-2 py-1.5 text-left ${j < 2 && n ? "bg-red-50" : "bg-subtle"}`}
                          onClick={() => (setKho(gop ? "" : t.kho), setMuc(MUC[j]))}
                        >
                          <div className={`text-base font-bold tabular-nums ${j < 2 && n ? "text-danger" : ""}`}>{fmtSo(n)}</div>
                          <div className="truncate text-[10px] leading-tight text-ink-soft">{MUC[j].slice(3)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div className="mb-4 hidden max-h-80 overflow-auto rounded-xl border border-line md:block">
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
          <div className="loc-bar">
            <ChonGiaTri nhan="Kho" giaTri={kho} dat={setKho} ds={duyNhat(rows.map((r) => r.kho))} />
            <Chon nhan="Cửa sổ" giaTri={cuaSo} dat={setCuaSo} luaChon={cs.map((d, j) => ({ v: String(j) as "0" | "1" | "2", t: `${d} ngày` }))} />
            <ChonGiaTri nhan="Mức cảnh báo" giaTri={muc} dat={setMuc} ds={MUC} />
            <ChonGiaTri nhan="Tần suất" giaTri={tanSuat} dat={setTanSuat} ds={["Tiêu nhiều", "Tiêu đều", "Khác (còn lại)", "Ít tiêu hao"]} />
            <ChonGiaTri nhan="Phân loại LK" giaTri={phanLoai} dat={setPhanLoai} ds={duyNhat(rows.map((r) => r.phan_loai))} />
          </div>
          <Bang rows={locTrang} cot={cot} idUrl="bang" onLoc={setDaLoc} timTheo={(r) => `${r.ma} ${r.ten} ${r.nhom_tuong_duong ?? ""}`} onClick={(r) => moLk(r.ma, daLoc.map((x) => x.ma))} />
          <p className="mt-2 text-xs text-ink-soft">
            Số ngày dư = Tồn / (Tiêu hao / số ngày) − số ngày cửa sổ − Leadtime · &lt; −3 thiếu nghiêm trọng · &lt; 0 thiếu · ≤ 2 tới thời điểm đặt · Tồn chuẩn = TB tiêu hao/ngày × Hệ số NK × 30.
          </p>
        </>
      )}
    </div>
  );
}
