import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtSo } from "../lib/api";
import { boDau, docFile, taiExcel } from "../lib/excel";
import { docKhaiBao, docKho, docSoChiTiet, docTonKho, docXuatThang, FILE_MAU, guiTheoLo, type XtRowTho } from "../lib/importers";
import { Bang, Icon, Loi, ThongBao, TieuDe, type Cot, type IconTen } from "../components/ui";

interface KhoDs { ma: string; ten: string; loai: string; ten_khac: string[] }
type Loai = "sct" | "ton" | "xt" | "kb" | "kho";

// Buoc "xem truoc": doc file xong hien tom tat + vai dong mau, nguoi dung bam Nhap moi gui len server.
interface XemTruoc {
  loai: Loai;
  file: string;
  tomTat: ReactNode[];
  tieuDe: string[];
  mau: (string | number | null)[][];
  canhBao?: string;
  gui: (tienDo: (s: string) => void) => Promise<string>;
}

const THE: { loai: Loai; ten: string; icon: IconTen; tanSuat: string; moTa: string; dung: string }[] = [
  { loai: "sct", ten: "Sổ chi tiết vật tư", icon: "nhat-ky", tanSuat: "Hằng ngày", moTa: "File MISA “Sổ chi tiết vật tư hàng hóa” 30 ngày gần nhất. Khoảng ngày của file (theo từng kho có trong file) được thay mới — import lại không cộng trùng.", dung: "Cảnh báo leadtime · xuất tháng hiện tại" },
  { loai: "ton", ten: "Tồn kho", icon: "kho", tanSuat: "Khi có file mới", moTa: "File MISA “Tổng hợp tồn kho” (Mã kho, Mã hàng, Đầu kỳ, Nhập, Xuất, Cuối kỳ). Mỗi file tạo 1 phiên tồn kho mới; báo cáo dùng phiên mới nhất. Tạm thay đồng bộ tự động từ linh-kien-app.", dung: "Mọi báo cáo · kỳ xuất KTV cho thu hồi" },
  { loai: "xt", ten: "Xuất kho theo tháng", icon: "lop", tanSuat: "1 lần / khi bổ sung", moTa: "Dữ liệu tĩnh các tháng cũ (Tháng, Tên kho / Mã kho, Mã hàng, Xuất kho). Mỗi tháng có trong file thay toàn bộ dữ liệu tháng đó. Tháng mới hệ thống tự chốt từ sổ chi tiết.", dung: "Đắp chiếu · Cảnh báo T5" },
  { loai: "kb", ten: "Khai báo linh kiện / giá nhập", icon: "hop", tanSuat: "Khi thay đổi", moTa: "Phân loại, ngành, nơi SX, hệ số, leadtime, giá nhập… Có thể chỉ gồm Mã + vài cột. Ô trống giữ giá trị cũ.", dung: "Hệ số dự trữ · giá trị tồn · thu hồi" },
  { loai: "kho", ten: "Thông tin kho KTV", icon: "nguoi", tanSuat: "Khi thay đổi", moTa: "Tên trên MISA / Mã kho, Làm việc, Phòng ban, Khu vực. Ghi đè thông tin đồng bộ; dòng không khớp kho nào được liệt kê lại.", dung: "LK thu hồi DVBH (Nhóm 1, lọc bộ phận / khu vực)" },
];

const LOAI_LOG: Record<string, string> = { so_chi_tiet: "Sổ chi tiết", xuat_thang: "Xuất tháng", ton_kho: "Tồn kho", khai_bao_lk: "Khai báo LK", kho: "Kho" };

export default function ImportDuLieu({ laAdmin }: { laAdmin: boolean }) {
  const qc = useQueryClient();
  const [xem, setXem] = useState<XemTruoc | null>(null);
  const [ban, setBan] = useState(false);
  const [tienDo, setTienDo] = useState("");
  const [ketQua, setKetQua] = useState<{ loai: "success" | "danger"; chu: string } | null>(null);
  const [kyTon, setKyTon] = useState({ tu: "", den: "" });
  const kyRef = useRef(kyTon);
  kyRef.current = kyTon;
  const lichSu = useQuery({ queryKey: ["import-lich-su"], queryFn: () => api<{ rows: Record<string, string | number | null>[] }>("/import/lich-su") });

  // Xuat thang: ten kho chua khop -> nguoi dung chon kho (luu thanh "ten khac" de lan sau tu khop).
  const [choKho, setChoKho] = useState<{ file: string; rows: XtRowTho[]; chuaKhop: string[]; dsKho: KhoDs[] } | null>(null);
  const [chonKho, setChonKho] = useState<Record<string, string>>({});

  const docVaXem = async (loai: Loai, f: File, nguonGia?: "import" | "drive") => {
    setKetQua(null);
    setXem(null);
    setBan(true);
    setTienDo("Đang đọc file…");
    try {
      const raw = await docFile(f);
      setXem(await taoXemTruoc(loai, f.name, raw, nguonGia));
    } catch (e) {
      setKetQua({ loai: "danger", chu: `${f.name}: ${(e as Error).message}` });
    } finally {
      setBan(false);
      setTienDo("");
    }
  };

  const taoXemTruoc = async (loai: Loai, file: string, raw: unknown[][], nguonGia?: "import" | "drive"): Promise<XemTruoc | null> => {
    if (loai === "sct") {
      const { rows, bo_qua } = docSoChiTiet(raw);
      if (!rows.length) throw new Error("File không có dòng dữ liệu hợp lệ.");
      const ngay = rows.map((r) => r.ngay_hach_toan).sort();
      return {
        loai, file,
        tomTat: [`${fmtSo(rows.length)} dòng phát sinh`, `${ngay[0]} → ${ngay[ngay.length - 1]}`, `${new Set(rows.map((r) => r.ma_kho)).size} kho`, `${new Set(rows.map((r) => r.ma_hang)).size} mã hàng`, bo_qua ? `bỏ qua ${fmtSo(bo_qua)} dòng số dư / trống` : null].filter(Boolean),
        tieuDe: ["Ngày", "Mã kho", "Mã hàng", "Tên hàng", "Nhập", "Xuất"],
        mau: rows.slice(0, 6).map((r) => [r.ngay_hach_toan, r.ma_kho, r.ma_hang, r.ten_hang, r.sl_nhap, r.sl_xuat]),
        gui: async (td) => {
          const kq = (await guiTheoLo("/import/so-chi-tiet", rows, file, (d, t) => td(`Đang gửi ${fmtSo(d)}/${fmtSo(t)} dòng…`))) as { tu_ngay: string; den_ngay: string; so_dong: number; da_xoa_cu: number };
          return `Đã lưu ${fmtSo(kq.so_dong)} dòng sổ chi tiết ${kq.tu_ngay} → ${kq.den_ngay} (thay ${fmtSo(kq.da_xoa_cu)} dòng cũ cùng khoảng).`;
        },
      };
    }
    if (loai === "ton") {
      const { rows, bo_qua } = docTonKho(raw);
      if (!rows.length) throw new Error("File không có dòng tồn kho hợp lệ.");
      const tong = rows.reduce((a, r) => a + r.cuoi_ky, 0);
      return {
        loai, file,
        tomTat: [`${fmtSo(rows.length)} dòng`, `${new Set(rows.map((r) => r.ma_kho)).size} kho`, `${new Set(rows.map((r) => r.ma_hang)).size} mã hàng`, `tổng cuối kỳ ${fmtSo(tong, 2)}`, bo_qua ? `bỏ qua ${fmtSo(bo_qua)} dòng tổng / trống` : null].filter(Boolean),
        tieuDe: ["Mã kho", "Tên kho", "Mã hàng", "Tên hàng", "Đầu kỳ", "Nhập", "Xuất", "Cuối kỳ"],
        mau: rows.slice(0, 6).map((r) => [r.ma_kho, r.ten_kho, r.ma_hang, r.ten_hang, r.dau_ky, r.nhap_kho, r.xuat_kho, r.cuoi_ky]),
        canhBao: "Nhập kỳ của file (từ ngày – đến ngày) bên dưới để báo cáo thu hồi tính đúng số kỳ 2 tuần. Bỏ trống = dùng số kỳ mặc định ở Tham số.",
        gui: async (td) => {
          const kq = (await guiTheoLo("/import/ton-kho", rows, file, (d, t) => td(`Đang gửi ${fmtSo(d)}/${fmtSo(t)} dòng…`), {
            ky_tu_ngay: kyRef.current.tu || undefined,
            ky_den_ngay: kyRef.current.den || undefined,
          })) as { so_dong: number; so_dong_kho: number; so_dong_ktv: number };
          return `Đã tạo phiên tồn kho mới: ${fmtSo(kq.so_dong)} dòng (kho công ty / khác ${fmtSo(kq.so_dong_kho)}, kho KTV ${fmtSo(kq.so_dong_ktv)}). Mọi báo cáo đã dùng phiên này.`;
        },
      };
    }
    if (loai === "xt") {
      const { rows } = docXuatThang(raw);
      if (!rows.length) throw new Error("File không có dòng xuất nào.");
      const dsKho = (await api<{ rows: KhoDs[] }>("/cai-dat/kho")).rows;
      const ten = new Set<string>();
      for (const k of dsKho) for (const t of [k.ten, ...k.ten_khac]) ten.add(boDau(t));
      const maCo = new Set(dsKho.map((k) => k.ma));
      const chuaKhop = [...new Set(rows.filter((r) => !(r.ma_kho && maCo.has(r.ma_kho)) && !(r.ten_kho && ten.has(boDau(r.ten_kho)))).map((r) => r.ten_kho ?? r.ma_kho ?? ""))];
      const thang = rows.map((r) => r.thang).sort();
      if (chuaKhop.length) {
        setChonKho({});
        setChoKho({ file, rows, chuaKhop, dsKho });
        return null;
      }
      return {
        loai, file,
        tomTat: [`${fmtSo(rows.length)} dòng`, `tháng ${thang[0]} → ${thang[thang.length - 1]}`, `${new Set(rows.map((r) => r.thang)).size} tháng (sẽ thay toàn bộ các tháng này)`],
        tieuDe: ["Tháng", "Kho", "Mã hàng", "Tên hàng", "Xuất"],
        mau: rows.slice(0, 6).map((r) => [r.thang, r.ma_kho ?? r.ten_kho, r.ma_hang, r.ten_hang, r.sl_xuat]),
        gui: (td) => guiXuatThang(file, rows, dsKho, {}, td),
      };
    }
    if (loai === "kb") {
      const rows = docKhaiBao(raw);
      if (!rows.length) throw new Error("File không có mã linh kiện nào.");
      const cot = ["phan_loai", "nganh", "noi_san_xuat", "he_so_du_tru", "leadtime", "gia_nhap"] as const;
      const coCot = cot.filter((k) => rows.some((r) => k in r));
      return {
        loai, file,
        tomTat: [`${fmtSo(rows.length)} mã`, `cột nhận diện: ${coCot.join(", ") || "chỉ mã"}`, `${fmtSo(rows.filter((r) => r.gia_nhap != null).length)} mã có giá nhập`, nguonGia === "drive" ? "nguồn giá: Google Drive" : null].filter(Boolean),
        tieuDe: ["Mã", "Tên", "Phân loại", "Ngành", "Hệ số", "Leadtime", "Giá nhập"],
        mau: rows.slice(0, 6).map((r) => [r.ma, r.ten ?? null, r.phan_loai ?? null, r.nganh ?? null, r.he_so_du_tru ?? null, r.leadtime ?? null, r.gia_nhap ?? null]),
        gui: async (td) => {
          for (let i = 0; i < rows.length; i += 500) {
            await api("/import/khai-bao-lk", { method: "POST", json: { rows: rows.slice(i, i + 500), ten_file: file, nguon_gia: nguonGia ?? "import" } });
            td(`Đang gửi ${fmtSo(Math.min(i + 500, rows.length))}/${fmtSo(rows.length)} mã…`);
          }
          return `Đã cập nhật khai báo ${fmtSo(rows.length)} mã linh kiện.`;
        },
      };
    }
    const rows = docKho(raw);
    if (!rows.length) throw new Error("File không có dòng kho nào.");
    return {
      loai, file,
      tomTat: [`${fmtSo(rows.length)} kho`, `${rows.filter((r) => r.lam_viec && /nghi/i.test(boDau(r.lam_viec))).length} kho đang nghỉ`],
      tieuDe: ["Mã kho", "Tên", "Làm việc", "Phòng ban", "Khu vực"],
      mau: rows.slice(0, 6).map((r) => [r.ma ?? null, r.ten ?? null, r.lam_viec ?? null, r.phong_ban ?? null, r.khu_vuc ?? null]),
      gui: async () => {
        const kq = await api<{ da_cap_nhat: number; khong_khop: string[] }>("/cai-dat/kho/import", { method: "POST", json: { rows } });
        return `Đã cập nhật ${fmtSo(kq.da_cap_nhat)} kho.${kq.khong_khop.length ? ` ${kq.khong_khop.length} dòng không khớp kho nào: ${kq.khong_khop.slice(0, 10).join("; ")}${kq.khong_khop.length > 10 ? "…" : ""}` : ""}`;
      },
    };
  };

  const guiXuatThang = async (file: string, rows: XtRowTho[], dsKho: KhoDs[], them: Record<string, string>, td: (s: string) => void) => {
    const theoTen = new Map<string, string>();
    for (const k of dsKho) for (const t of [k.ten, ...k.ten_khac]) theoTen.set(boDau(t), k.ma);
    for (const [t, m] of Object.entries(them)) theoTen.set(boDau(t), m);
    const maCo = new Set([...dsKho.map((k) => k.ma), ...Object.values(them)]);
    const out = rows.flatMap((r) => {
      const mk = r.ma_kho && maCo.has(r.ma_kho) ? r.ma_kho : r.ten_kho ? theoTen.get(boDau(r.ten_kho)) : r.ma_kho;
      return mk && mk !== "__bo_qua__" ? [{ thang: r.thang, ma_kho: mk, ma_hang: r.ma_hang, ten_hang: r.ten_hang, sl_xuat: r.sl_xuat }] : [];
    });
    const kq = (await guiTheoLo("/import/xuat-thang", out, file, (d, t) => td(`Đang gửi ${fmtSo(d)}/${fmtSo(t)} dòng…`))) as { tu_thang: string; den_thang: string; so_dong: number };
    return `Đã lưu ${fmtSo(kq.so_dong)} dòng xuất tháng ${kq.tu_thang} → ${kq.den_thang} (thay toàn bộ các tháng có trong file).`;
  };

  const chay = async (fn: (td: (s: string) => void) => Promise<string>) => {
    setBan(true);
    setKetQua(null);
    try {
      const chu = await fn(setTienDo);
      setKetQua({ loai: "success", chu });
      setXem(null);
      qc.invalidateQueries();
    } catch (e) {
      const body = (e as { body?: { loi?: unknown } }).body;
      setKetQua({ loai: "danger", chu: `${(e as Error).message}${body?.loi ? ` ${JSON.stringify(body.loi).slice(0, 300)}` : ""}` });
    } finally {
      setBan(false);
      setTienDo("");
    }
  };

  const xacNhanKho = () =>
    chay(async (td) => {
      const ck = choKho!;
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
      return guiXuatThang(ck.file, ck.rows, ck.dsKho, them, td);
    });

  const lichSuCot: Cot<Record<string, string | number | null>>[] = [
    { ten: "Lúc", the: "phu" as const, lay: (r) => r.luc, sx: (r) => r.luc },
    { ten: "Loại", the: "nhan" as const, lay: (r) => <span className="badge bg-primary-soft text-primary">{LOAI_LOG[String(r.loai)] ?? r.loai}</span>, sx: (r) => r.loai },
    { ten: "File", the: "tieu_de" as const, lay: (r) => <span className="inline-block max-w-[260px] truncate align-bottom" title={String(r.ten_file ?? "")}>{r.ten_file}</span> },
    { ten: "Người", the: "phu" as const, lay: (r) => r.nguoi },
    { ten: "Số dòng", lay: (r) => fmtSo(Number(r.so_dong)), so: true, sx: (r) => Number(r.so_dong) },
    { ten: "Khoảng dữ liệu", lay: (r) => (r.tu_ngay ? `${r.tu_ngay} → ${r.den_ngay}` : "") },
    { ten: "Ghi chú", lay: (r) => <span className="text-ink-soft">{r.ghi_chu}</span> },
  ];

  return (
    <div className="space-y-4">
      <TieuDe
        ten="Nhập dữ liệu"
        moTa="Đọc file Excel / CSV ngay trên trình duyệt, xem trước rồi mới gửi lên. Import lại cùng khoảng ngày / tháng sẽ thay dữ liệu cũ, không cộng trùng."
      />

      {ketQua && <ThongBao loai={ketQua.loai}>{ketQua.loai === "success" ? "✓ " : "✕ "}{ketQua.chu}</ThongBao>}
      {tienDo && (
        <ThongBao>
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-primary" />
            {tienDo}
          </span>
        </ThongBao>
      )}

      {xem && (
        <div className="card border-primary ring-1 ring-primary/30">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="card-title">
              Xem trước: {THE.find((t) => t.loai === xem.loai)?.ten} — <span className="font-normal text-ink-soft">{xem.file}</span>
            </h2>
            <div className="flex gap-2">
              <button className="btn" disabled={ban} onClick={() => setXem(null)}>
                Huỷ
              </button>
              <button className="btn-primary" disabled={ban} onClick={() => chay(xem.gui)}>
                <Icon ten="tai-len" /> Nhập dữ liệu
              </button>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {xem.tomTat.map((t, i) => (
              <span key={i} className="chip">
                {t}
              </span>
            ))}
          </div>
          {xem.loai === "ton" && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-soft">Kỳ của file:</span>
              <input type="date" className="input" value={kyTon.tu} onChange={(e) => setKyTon({ ...kyTon, tu: e.target.value })} />
              <span>→</span>
              <input type="date" className="input" value={kyTon.den} onChange={(e) => setKyTon({ ...kyTon, den: e.target.value })} />
            </div>
          )}
          {xem.canhBao && <p className="mb-3 text-xs text-ink-soft">{xem.canhBao}</p>}
          <div className="overflow-auto rounded-lg border border-line">
            <table className="tbl">
              <thead>
                <tr>
                  {xem.tieuDe.map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {xem.mau.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j} className={typeof v === "number" ? "so" : ""}>
                        {typeof v === "number" ? fmtSo(v, 2) : v ?? <span className="text-ink-soft">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-soft">6 dòng đầu sau khi nhận diện cột.</p>
        </div>
      )}

      {choKho && (
        <div className="card border-amber-300">
          <h2 className="card-title mb-1">Khớp tên kho — {choKho.file}</h2>
          <p className="mb-3 text-sm text-ink-soft">{choKho.chuaKhop.length} tên kho trong file chưa khớp kho nào. Chọn kho tương ứng — lần sau tự khớp.</p>
          <div className="max-h-80 space-y-2 overflow-auto">
            {choKho.chuaKhop.map((t) => (
              <div key={t} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-full truncate font-medium sm:w-72" title={t}>
                  {t}
                </span>
                <select className="input" value={chonKho[t] ?? ""} onChange={(e) => setChonKho((c) => ({ ...c, [t]: e.target.value }))}>
                  <option value="">— chọn —</option>
                  <option value="__moi__">Tạo kho mới (mã = tên)</option>
                  <option value="__bo_qua__">Bỏ qua các dòng của kho này</option>
                  {choKho.dsKho.map((k) => (
                    <option key={k.ma} value={k.ma}>
                      {k.ma} — {k.ten}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn" onClick={() => setChonKho(Object.fromEntries(choKho.chuaKhop.map((t) => [t, "__moi__"])))}>
              Tạo kho mới cho tất cả
            </button>
            <button className="btn-primary" disabled={ban || choKho.chuaKhop.some((t) => !chonKho[t])} onClick={xacNhanKho}>
              Tiếp tục nhập
            </button>
            <button className="btn" onClick={() => setChoKho(null)}>
              Huỷ
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {THE.map((t) => (
          <div key={t.loai} className="card flex flex-col">
            <div className="mb-1 flex items-start gap-3">
              <span className="rounded-lg bg-primary-soft p-2 text-primary">
                <Icon ten={t.icon} cls="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{t.ten}</h2>
                  <span className="chip">{t.tanSuat}</span>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{t.moTa}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Dùng cho: <b className="font-medium text-ink">{t.dung}</b>
                </p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 pt-3">
              <ChonFile nhan="Chọn file" ban={ban} onFile={(f) => docVaXem(t.loai, f)} />
              {t.loai === "kb" && <ChonFile nhan="File giá nhập (Drive)" phu ban={ban} onFile={(f) => docVaXem("kb", f, "drive")} />}
              <button className="btn" onClick={() => taiExcel(FILE_MAU[t.loai].ten, FILE_MAU[t.loai].tieu_de, FILE_MAU[t.loai].vi_du)}>
                <Icon ten="tai-xuong" /> File mẫu
              </button>
            </div>
          </div>
        ))}
        <DongBo laAdmin={laAdmin} />
      </div>

      <div className="card">
        <h2 className="card-title mb-2">Lịch sử nhập dữ liệu</h2>
        <Bang rows={lichSu.data?.rows ?? []} cot={lichSuCot} kichThuoc={25} timTheo={(r) => `${r.ten_file} ${r.loai} ${r.nguoi}`} />
      </div>
    </div>
  );
}

function ChonFile({ nhan, onFile, ban, phu }: { nhan: string; onFile: (f: File) => void; ban: boolean; phu?: boolean }) {
  return (
    <label className={`${phu ? "btn" : "btn-primary"} cursor-pointer ${ban ? "pointer-events-none opacity-50" : ""}`}>
      <Icon ten="tai-len" /> {nhan}
      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => (e.target.files?.[0] && onFile(e.target.files[0]), (e.target.value = ""))} />
    </label>
  );
}

// The dong bo linh-kien-app: API chua trien khai -> hien trang thai lan chay cuoi, nut chay tay van giu.
function DongBo({ laAdmin }: { laAdmin: boolean }) {
  const qc = useQueryClient();
  const tt = useQuery({ queryKey: ["dong-bo"], queryFn: () => api<Record<string, Record<string, unknown>>>("/dong-bo/trang-thai") });
  const chay = useMutation({ mutationFn: () => api("/dong-bo/chay", { method: "POST", json: {} }), onSettled: () => qc.invalidateQueries() });
  const chot = useMutation({ mutationFn: () => api<{ da_chot: unknown }>("/dong-bo/chot-thang", { method: "POST" }), onSettled: () => qc.invalidateQueries() });
  const ds = Object.entries(tt.data ?? {});
  return (
    <div className="card flex flex-col">
      <div className="mb-1 flex items-start gap-3">
        <span className="rounded-lg bg-subtle p-2 text-ink-soft">
          <Icon ten="thu-hoi" cls="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Đồng bộ linh-kien-app</h2>
            <span className="chip">Chưa kết nối API</span>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Khi API được triển khai: tồn kho tự kéo mỗi giờ, danh mục linh kiện + danh bạ kho / KTV lúc 1h sáng. Hiện tại dùng ô “Tồn kho” bên cạnh để nhập file.
          </p>
          {ds.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
              {ds.map(([k, v]) => (
                <li key={k}>
                  <b className="text-ink">{k}</b>: {String(v.trang_thai ?? v.loi ?? "")} · {String(v.updated_at ?? "")}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <button className="btn" disabled={chay.isPending || !laAdmin} onClick={() => chay.mutate()}>
          {chay.isPending ? "Đang đồng bộ…" : "⟳ Thử đồng bộ ngay"}
        </button>
        <button className="btn" disabled={chot.isPending} onClick={() => chot.mutate()} title="Ghi tĩnh xuất các tháng đã qua vào bảng xuất tháng">
          Chốt tĩnh tháng cũ
        </button>
      </div>
      {chay.error && <div className="mt-2"><Loi loi={chay.error} /></div>}
      {chot.data && <p className="mt-2 text-xs text-success">Đã chốt: {JSON.stringify(chot.data.da_chot)}</p>}
    </div>
  );
}
