import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtSo } from "../lib/api";
import { boDau, docFile } from "../lib/excel";
import { docKhaiBao, docKho, docSoChiTiet, docXuatThang, guiTheoLo, type XtRowTho } from "../lib/importers";
import { TieuDe } from "../components/ui";

interface KhoDs { ma: string; ten: string; loai: string; ten_khac: string[] }

function Khoi({ ten, moTa, children }: { ten: string; moTa: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <h2 className="font-semibold">{ten}</h2>
      <div className="mb-3 mt-1 text-sm text-ink-soft">{moTa}</div>
      {children}
    </div>
  );
}

function ChonFile({ nhan, onFile, ban }: { nhan: string; onFile: (f: File) => void; ban: boolean }) {
  return (
    <label className={`btn-primary cursor-pointer ${ban ? "pointer-events-none opacity-50" : ""}`}>
      {nhan}
      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => (e.target.files?.[0] && onFile(e.target.files[0]), (e.target.value = ""))} />
    </label>
  );
}

export default function ImportDuLieu() {
  const qc = useQueryClient();
  const [trangThai, setTrangThai] = useState<Record<string, string>>({});
  const [ban, setBan] = useState(false);
  const bao = (k: string, s: string) => setTrangThai((t) => ({ ...t, [k]: s }));
  const lichSu = useQuery({ queryKey: ["import-lich-su"], queryFn: () => api<{ rows: Record<string, string | number | null>[] }>("/import/lich-su") });
  const dongBo = useQuery({ queryKey: ["dong-bo"], queryFn: () => api<Record<string, Record<string, unknown>>>("/dong-bo/trang-thai") });
  const lamMoi = () => qc.invalidateQueries();

  const chay = async (k: string, fn: () => Promise<string>) => {
    setBan(true);
    bao(k, "Đang đọc file…");
    try {
      bao(k, await fn());
      lamMoi();
    } catch (e) {
      const body = (e as { body?: { loi?: unknown } }).body;
      bao(k, `❌ ${(e as Error).message}${body?.loi ? ` ${JSON.stringify(body.loi).slice(0, 300)}` : ""}`);
    } finally {
      setBan(false);
    }
  };

  // ---- Xuat thang tinh: quy ten kho -> ma kho; ten chua khop thi nguoi dung chon kho (luu thanh "ten khac")
  const [choKho, setChoKho] = useState<{ file: string; rows: XtRowTho[]; chuaKhop: string[]; dsKho: KhoDs[] } | null>(null);
  const [chonKho, setChonKho] = useState<Record<string, string>>({});

  const guiXuatThang = async (file: string, rows: XtRowTho[], dsKho: KhoDs[], them: Record<string, string>) => {
    const theoTen = new Map<string, string>();
    for (const k of dsKho) for (const t of [k.ten, ...k.ten_khac]) theoTen.set(boDau(t), k.ma);
    for (const [t, m] of Object.entries(them)) theoTen.set(boDau(t), m);
    const maCo = new Set([...dsKho.map((k) => k.ma), ...Object.values(them)]);
    const out = rows.flatMap((r) => {
      const mk = r.ma_kho && maCo.has(r.ma_kho) ? r.ma_kho : r.ten_kho ? theoTen.get(boDau(r.ten_kho)) : r.ma_kho;
      return mk && mk !== "__bo_qua__" ? [{ thang: r.thang, ma_kho: mk, ma_hang: r.ma_hang, ten_hang: r.ten_hang, sl_xuat: r.sl_xuat }] : [];
    });
    const kq = (await guiTheoLo("/import/xuat-thang", out, file, (d, t) => bao("xt", `Đang gửi ${fmtSo(d)}/${fmtSo(t)} dòng…`))) as { tu_thang: string; den_thang: string; so_dong: number };
    return `✅ Đã lưu ${fmtSo(kq.so_dong)} dòng, tháng ${kq.tu_thang} → ${kq.den_thang} (thay toàn bộ các tháng có trong file).`;
  };

  const xacNhanKho = () =>
    chay("xt", async () => {
      const ck = choKho!;
      // Luu anh xa ten -> kho vao "ten khac" de lan sau tu khop; "Tao kho moi" = ma kho = ten.
      for (const t of ck.chuaKhop) {
        const v = chonKho[t];
        if (!v || v === "__bo_qua__") continue;
        if (v === "__moi__") await api(`/cai-dat/kho/${encodeURIComponent(t)}`, { method: "PUT", json: { ten: t, loai: "cong_ty" } });
        else {
          const k = ck.dsKho.find((x) => x.ma === v)!;
          await api(`/cai-dat/kho/${encodeURIComponent(v)}`, { method: "PUT", json: { ten_khac: [...k.ten_khac, t] } });
        }
      }
      const them = Object.fromEntries(ck.chuaKhop.map((t) => [t, chonKho[t] === "__moi__" ? t : chonKho[t] || "__bo_qua__"]));
      setChoKho(null);
      return guiXuatThang(ck.file, ck.rows, ck.dsKho, them);
    });

  const dongBoNgay = useMutation({ mutationFn: (epBuoc: boolean) => api("/dong-bo/chay", { method: "POST", json: { ep_buoc: epBuoc } }), onSettled: lamMoi });

  return (
    <div className="space-y-4">
      <TieuDe ten="Nhập & đồng bộ dữ liệu" moTa="Đọc file Excel ngay trên trình duyệt, gửi lên theo lô. Import lại cùng khoảng ngày / tháng sẽ thay dữ liệu cũ, không cộng trùng." />

      <Khoi ten="1. Sổ chi tiết vật tư (hằng ngày)" moTa="File MISA “Sổ chi tiết vật tư hàng hóa” 30 ngày gần nhất. Dữ liệu trong khoảng ngày của file (theo từng kho có trong file) được thay mới. Dùng cho Cảnh báo leadtime và xuất tháng hiện tại.">
        <ChonFile
          nhan="⬆ Chọn file sổ chi tiết"
          ban={ban}
          onFile={(f) =>
            chay("sct", async () => {
              const { rows, bo_qua } = docSoChiTiet(await docFile(f));
              if (!rows.length) throw new Error("File không có dòng dữ liệu hợp lệ.");
              const kq = (await guiTheoLo("/import/so-chi-tiet", rows, f.name, (d, t) => bao("sct", `Đang gửi ${fmtSo(d)}/${fmtSo(t)} dòng…`))) as { tu_ngay: string; den_ngay: string; so_dong: number };
              return `✅ Đã lưu ${fmtSo(kq.so_dong)} dòng, ${kq.tu_ngay} → ${kq.den_ngay}${bo_qua ? ` (bỏ qua ${fmtSo(bo_qua)} dòng số dư / trống)` : ""}.`;
            })
          }
        />
        <p className="mt-2 text-sm">{trangThai.sct}</p>
      </Khoi>

      <Khoi ten="2. Xuất kho theo tháng (dữ liệu tĩnh)" moTa="File các tháng cũ (cột Tháng, Tên kho / Mã kho, Mã hàng, Xuất kho — như sheet “1.1. Data kho Cũ”). Mỗi tháng có trong file thay toàn bộ dữ liệu tháng đó. Tháng mới hệ thống tự chốt từ sổ chi tiết sau 3 tháng.">
        <ChonFile
          nhan="⬆ Chọn file xuất tháng"
          ban={ban}
          onFile={(f) =>
            chay("xt", async () => {
              const { rows } = docXuatThang(await docFile(f));
              if (!rows.length) throw new Error("File không có dòng xuất nào.");
              const dsKho = (await api<{ rows: KhoDs[] }>("/cai-dat/kho")).rows;
              const ten = new Set<string>();
              for (const k of dsKho) for (const t of [k.ten, ...k.ten_khac]) ten.add(boDau(t));
              const maCo = new Set(dsKho.map((k) => k.ma));
              const chuaKhop = [...new Set(rows.filter((r) => !(r.ma_kho && maCo.has(r.ma_kho)) && !(r.ten_kho && ten.has(boDau(r.ten_kho)))).map((r) => r.ten_kho ?? r.ma_kho ?? ""))];
              if (chuaKhop.length) {
                setChonKho({});
                setChoKho({ file: f.name, rows, chuaKhop, dsKho });
                return `⚠ ${chuaKhop.length} tên kho chưa khớp — chọn kho tương ứng bên dưới rồi bấm Tiếp tục.`;
              }
              return guiXuatThang(f.name, rows, dsKho, {});
            })
          }
        />
        <p className="mt-2 text-sm">{trangThai.xt}</p>
        {choKho && (
          <div className="mt-3 space-y-2 rounded-lg border border-line p-3">
            {choKho.chuaKhop.map((t) => (
              <div key={t} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-80 truncate font-medium" title={t}>{t}</span>
                <select className="input" value={chonKho[t] ?? ""} onChange={(e) => setChonKho((c) => ({ ...c, [t]: e.target.value }))}>
                  <option value="">— chọn —</option>
                  <option value="__moi__">Tạo kho mới (mã = tên)</option>
                  <option value="__bo_qua__">Bỏ qua các dòng của kho này</option>
                  {choKho.dsKho.map((k) => (
                    <option key={k.ma} value={k.ma}>{k.ma} — {k.ten}</option>
                  ))}
                </select>
              </div>
            ))}
            <div className="flex gap-2">
              <button className="btn-primary" disabled={ban || choKho.chuaKhop.some((t) => !chonKho[t])} onClick={xacNhanKho}>Tiếp tục</button>
              <button className="btn" onClick={() => setChoKho(null)}>Huỷ</button>
            </div>
          </div>
        )}
      </Khoi>

      <Khoi ten="3. Khai báo linh kiện / giá nhập" moTa="File như sheet “3. Khai báo linh kiện” (Mã sản phẩm, Loại LK, Giá nhập, Nhóm linh kiện đặc biệt = Phân loại, Ngành, Hệ số, Leadtime, Đối tác…) hoặc chỉ 2 cột Mã + Giá nhập. Ô trống giữ giá trị cũ.">
        <div className="flex flex-wrap gap-2">
          {(["import", "drive"] as const).map((nguon) => (
            <ChonFile
              key={nguon}
              nhan={nguon === "import" ? "⬆ Chọn file khai báo" : "⬆ File giá nhập từ Google Drive"}
              ban={ban}
              onFile={(f) =>
                chay("kb", async () => {
                  const rows = docKhaiBao(await docFile(f));
                  if (!rows.length) throw new Error("File không có mã linh kiện nào.");
                  for (let i = 0; i < rows.length; i += 500) {
                    await api("/import/khai-bao-lk", { method: "POST", json: { rows: rows.slice(i, i + 500), ten_file: f.name, nguon_gia: nguon } });
                    bao("kb", `Đang gửi ${fmtSo(Math.min(i + 500, rows.length))}/${fmtSo(rows.length)} mã…`);
                  }
                  return `✅ Đã cập nhật ${fmtSo(rows.length)} mã linh kiện.`;
                })
              }
            />
          ))}
        </div>
        <p className="mt-2 text-sm">{trangThai.kb}</p>
      </Khoi>

      <Khoi ten="4. Thông tin kho KTV" moTa="File như sheet “4.3. Cài đặt kho” (Tên trên MISA / Mã kho, Làm việc, Phòng ban, Khu vực). Ghi đè thông tin đồng bộ từ linh-kien-app; dòng không khớp kho nào được liệt kê lại.">
        <ChonFile
          nhan="⬆ Chọn file kho KTV"
          ban={ban}
          onFile={(f) =>
            chay("kho", async () => {
              const rows = docKho(await docFile(f));
              const kq = await api<{ da_cap_nhat: number; khong_khop: string[] }>("/cai-dat/kho/import", { method: "POST", json: { rows } });
              return `✅ Đã cập nhật ${fmtSo(kq.da_cap_nhat)} kho.${kq.khong_khop.length ? ` ${kq.khong_khop.length} dòng không khớp kho nào: ${kq.khong_khop.slice(0, 10).join("; ")}${kq.khong_khop.length > 10 ? "…" : ""}` : ""}`;
            })
          }
        />
        <p className="mt-2 text-sm">{trangThai.kho}</p>
      </Khoi>

      <Khoi ten="5. Đồng bộ từ linh-kien-app" moTa="Tự chạy mỗi giờ (tồn kho — chỉ tải khi Kế toán import file mới) và 1h sáng (danh mục linh kiện, danh bạ kho / KTV, chốt tháng).">
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={dongBo.isLoading || dongBoNgay.isPending} onClick={() => dongBoNgay.mutate(false)}>
            {dongBoNgay.isPending ? "Đang đồng bộ…" : "⟳ Đồng bộ ngay"}
          </button>
          <button className="btn" disabled={dongBoNgay.isPending} onClick={() => dongBoNgay.mutate(true)}>Tải lại tồn kho (ép buộc)</button>
        </div>
        <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-subtle p-2 text-xs">{JSON.stringify(dongBoNgay.data ?? dongBo.data ?? {}, null, 2)}</pre>
      </Khoi>

      <div className="card">
        <h2 className="mb-2 font-semibold">Lịch sử import</h2>
        <div className="max-h-80 overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Lúc</th>
                <th>Loại</th>
                <th>File</th>
                <th>Người</th>
                <th className="so">Số dòng</th>
                <th>Khoảng dữ liệu</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {(lichSu.data?.rows ?? []).map((r) => (
                <tr key={String(r.id)}>
                  <td>{r.luc}</td>
                  <td>{r.loai}</td>
                  <td>{r.ten_file}</td>
                  <td>{r.nguoi}</td>
                  <td className="so">{fmtSo(Number(r.so_dong))}</td>
                  <td>{r.tu_ngay ? `${r.tu_ngay} → ${r.den_ngay}` : ""}</td>
                  <td>{r.ghi_chu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
