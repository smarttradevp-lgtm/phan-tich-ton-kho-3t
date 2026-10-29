// Doi chieu bo tinh toan voi so lieu that cua Google Sheet "BC tồn kho 3T" (xuat ngay 29/10/2026).
// Fixture: test/fixtures/*.json (sinh tu file .xlsx xuat tu Sheet, chi giu cot can doi chieu).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { roundUp, thangLui, dayThang, ngayLui, soNgayGiua } from "../src/lib/tinhToan/chung.ts";
import { THAM_SO_MAC_DINH, docThamSo } from "../src/lib/tinhToan/thamSo.ts";
import { phanLoaiDapChieu, xepLoai, tinhDapChieu, locT5 } from "../src/lib/tinhToan/dapChieu.ts";
import { mucCanhBao, tanSuat, tinhLeadtime } from "../src/lib/tinhToan/leadtime.ts";
import { tinhThuHoi, phanNhomThuHoi, tongHopThuHoi } from "../src/lib/tinhToan/thuHoi.ts";

const ts = THAM_SO_MAC_DINH;
const fixture = <T>(f: string) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8")) as T;

test("roundUp giong ROUNDUP cua Sheets", () => {
  assert.equal(roundUp(4), 4);
  assert.equal(roundUp(12 / 3), 4);
  assert.equal(roundUp(4.01), 5);
  assert.equal(roundUp(0), 0);
  assert.equal(roundUp(-1.2), -2);
});

test("thang / ngay", () => {
  assert.equal(thangLui("202610", 1), "202609");
  assert.equal(thangLui("202601", 1), "202512");
  assert.equal(thangLui("202610", 15), "202507");
  assert.deepEqual(dayThang("202602", 3), ["202602", "202601", "202512"]);
  assert.equal(ngayLui("2026-10-28", 30), "2026-09-28");
  assert.equal(soNgayGiua("2026-01-01", "2026-07-01"), 181);
});

test("docThamSo: thieu khoa / sai kieu -> mac dinh", () => {
  const t = docThamSo({ he_so_du_tru_mac_dinh: 5, cua_so_ngay: [1, 2], leadtime_mac_dinh: "x" });
  assert.equal(t.he_so_du_tru_mac_dinh, 5);
  assert.deepEqual(t.cua_so_ngay, [7, 14, 30]);
  assert.equal(t.leadtime_mac_dinh, 3);
});

type DcFix = { nganh: string; pl_dc: string; du_tru: number; ton_du: number; xep_loai: string; xuat12: number[] };

test("Phan loai dap chieu khop 100% Sheet (3.546 dong)", () => {
  const rows = fixture<DcFix[]>("dap_chieu_sheet.json");
  assert.ok(rows.length > 3000);
  const sai = rows.filter((r) => phanLoaiDapChieu(r.xuat12, r.nganh) !== r.pl_dc);
  assert.equal(sai.length, 0, JSON.stringify(sai.slice(0, 3)));
});

test("Xep loai T1-T5 khop 100% Sheet khi cung du tru / ton du", () => {
  const rows = fixture<DcFix[]>("dap_chieu_sheet.json");
  const sai = rows.filter((r) => xepLoai(r.ton_du, r.du_tru) !== r.xep_loai);
  assert.equal(sai.length, 0, JSON.stringify(sai.slice(0, 3)));
});

test("Dap chieu: TB chia co dinh 3/6 (thang khong xuat = 0), du tru, ton du, gia tri", () => {
  const xuat = new Map([["202610", 0], ["202609", 0], ["202608", 12], ["202605", 6]]);
  const kb = new Map([["A", { he_so_du_tru: 1.5, gia_nhap: 1000, nganh: "Lọc nước", phan_loai: "Linh kiện thường dùng" }]]);
  const [r] = tinhDapChieu("202610", [{ nhom: "Kho 6803", ma: "A", ten: "LK A", ton: 3, xuat }], kb, ts);
  assert.equal(r.tb3, 4); // 12/3 (Sheet AVERAGEA ra 12)
  assert.equal(r.tb6, 3); // 18/6
  assert.equal(r.du_tru, 3); // ROUNDUP((4 + 0)/2 * 1.5)
  assert.equal(r.ton_du, 0);
  assert.equal(r.xep_loai, "T1");
  assert.equal(r.phan_loai_dap_chieu, "B02");
  assert.equal(r.gia_tri_ton, 3000);
  assert.equal(r.xuat.length, 16);
  assert.equal(r.xuat[2], 12);
});

test("Dap chieu: LK chua khai bao -> he so mac dinh 2, nhan 'Chưa khai báo', gia = 0", () => {
  const [r] = tinhDapChieu("202610", [{ nhom: "Gộp chung", ma: "X", ten: "X", ton: 0, xuat: new Map([["202610", 3]]) }], new Map(), ts);
  assert.equal(r.he_so, 2);
  assert.equal(r.du_tru, 4); // ROUNDUP((1 + 3)/2 * 2)
  assert.equal(r.xep_loai, "T5");
  assert.equal(r.phan_loai, "Chưa khai báo");
  assert.equal(r.gia_tri_ton, 0);
  assert.equal(r.gia_nhap_nguon, "khong_co");
});

test("T5: bo LK cat ma, xep thieu nhieu nhat len dau", () => {
  const mk = (ma: string, ton: number, pl: string) => ({ nhom: "K", ma, ten: ma, ton, xuat: new Map([["202610", 10]]) });
  const kb = new Map([["C", { phan_loai: "Thuộc diện cắt mã" }]]);
  const rows = tinhDapChieu("202610", [mk("A", 5, ""), mk("B", 0, ""), mk("C", 0, "")], kb, ts);
  assert.deepEqual(locT5(rows).map((r) => r.ma), ["B", "A"]);
});

type LtFix = { th: [number, number, number]; ton: number; he_so: number | null; leadtime: number | null; k: string; l: string; m: string; n: number; o: number; s: string };

// LK co dong khai bao nhung de TRONG he so / leadtime: Sheet VLOOKUP tra o trong = 0 (khong phai mac dinh 3).
// App co y dung mac dinh 3 cho o trong (docs/DAC_TA_LOGIC.md) - o day truyen 0 de doi chieu dung cong thuc.
test("Leadtime: muc canh bao 7/14/30, TB/ngay, ton chuan, tan suat khop Sheet", () => {
  const rows = fixture<LtFix[]>("leadtime_sheet.json");
  assert.ok(rows.length > 1000);
  const hoa = (s: string) => s.toLowerCase();
  let sai = 0;
  const vd: unknown[] = [];
  for (const r of rows) {
    const [kq] = tinhLeadtime([{ kho: "", ma: "", ten: "", tieu_hao: r.th, ton: r.ton, he_so_nk: r.he_so ?? 0, leadtime: r.leadtime ?? 0 }], ts);
    const ok =
      hoa(kq.canh_bao[0]) === hoa(r.k) &&
      hoa(kq.canh_bao[1]) === hoa(r.l) &&
      hoa(kq.canh_bao[2]) === hoa(r.m) &&
      Math.abs(kq.tb_ngay - r.n) < 1e-6 * Math.max(1, r.n) &&
      Math.abs(kq.ton_chuan - r.o) < 1e-6 * Math.max(1, r.o) &&
      kq.tan_suat === r.s;
    if (!ok) {
      sai++;
      if (vd.length < 3) vd.push({ r, kq });
    }
  }
  assert.equal(sai, 0, JSON.stringify(vd));
});

test("Leadtime: tru ca do dai cua so + leadtime; tru hang dang ve vao SL can dat", () => {
  // ton 10, tieu hao 7 ngay = 7 -> 1/ngay -> du 10 ngay - 7 - 3 = 0 -> "3. Toi thoi diem dat hang"
  assert.deepEqual(mucCanhBao(10, 7, 7, 3, ts), { muc: "3. Tới thời điểm đặt hàng", soNgay: 0 });
  assert.equal(mucCanhBao(0, 0, 7, 3, ts).muc, "5. Hết tồn - không tiêu hao");
  assert.equal(mucCanhBao(5, 0, 7, 3, ts).muc, "6. Còn tồn - không tiêu hao");
  assert.equal(tanSuat([20, 50, 100], ts), "Tiêu nhiều");
  const [r] = tinhLeadtime([{ kho: "K", ma: "A", ten: "A", tieu_hao: [7, 14, 30], ton: 10, hang_dang_ve: 5 }], ts);
  assert.equal(r.ton_chuan, 90); // 1/ngay * 3 * 30
  assert.equal(r.sl_thieu_can_dat, 75);
});

test("Thu hoi: phan nhom 1-4, xuat trong = 0 roi vao Nhom 2, ton chuan theo so ky 2 tuan", () => {
  assert.equal(phanNhomThuHoi({ lam_viec: false, ton: 5, xuat: 3, ton_chuan: 0 }), "Nhóm 1");
  assert.equal(phanNhomThuHoi({ lam_viec: true, ton: 5, xuat: null, ton_chuan: 0 }), "Nhóm 2");
  assert.equal(phanNhomThuHoi({ lam_viec: true, ton: 5, xuat: 24, ton_chuan: 2 }), "Nhóm 3");
  assert.equal(phanNhomThuHoi({ lam_viec: true, ton: 2, xuat: 24, ton_chuan: 2 }), "Nhóm 4");
  const maTran = new Map([["Linh kiện thường dùng", new Map([["Nhóm 3", "Theo dõi tiếp"]])]]);
  const rows = tinhThuHoi(
    [
      { kho: "KTV A", ma: "1", ten: "", xuat: 24, ton: 5, lam_viec: true, phan_loai: "Linh kiện thường dùng", he_so: 1 },
      { kho: "KTV B", ma: "1", ten: "", xuat: null, ton: 3, lam_viec: true, phan_loai: "Linh kiện thường dùng", he_so: 1 },
    ],
    12,
    maTran,
  );
  assert.equal(rows[0].ton_chuan, 2); // ROUNDUP(24/12*1)
  assert.equal(rows[0].nhom, "Nhóm 3");
  assert.equal(rows[0].danh_gia, "Theo dõi tiếp");
  assert.equal(rows[1].nhom, "Nhóm 2");
  const [th] = tongHopThuHoi(rows);
  assert.equal(th.tong, 8);
  assert.equal(th.theo_nhom["Nhóm 2"], 3);
});
