// Goi API doi tac cua cac he thong khac LUC MO "Hồ sơ linh kiện" (khong luu D1 - giong cach app DVBH lam):
//  - linh-kien-app (/api/partner/v1/*): danh muc chi tiet (anh, gia, thay the, combo, cong no), lich su dat hang,
//    ticket thieu hang, ton kho kha dung. Khoa: LINHKIEN_API_KEY; Service Binding LINHKIEN_SERVICE neu co.
//  - app DVBH (/api/partner/thieu-linh-kien?ma_lk=): ca dang bao thieu ma. Khoa: DVBH_API_KEY; binding DVBH_SERVICE.
// Moi nguon tra { trang_thai: "chua_cau_hinh" | "loi" | "ok" } - 1 nguon loi khong lam hong nguon khac.
import type { Env } from "../types";

export type KetQuaNguon<T> = { trang_thai: "chua_cau_hinh" } | { trang_thai: "loi"; loi: string } | ({ trang_thai: "ok" } & T);

const HET_GIO_MS = 8000;

async function goi<T>(base: string, khoa: string, dich: Fetcher | undefined, duongDan: string): Promise<T> {
  const req = new Request(new URL(duongDan, base), { headers: { "X-API-Key": khoa }, signal: AbortSignal.timeout(HET_GIO_MS) });
  const res = dich ? await dich.fetch(req) : await fetch(req);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`HTTP ${res.status}${body?.error ? ` ${body.error}` : ""}`);
  }
  return (await res.json()) as T;
}

async function boc<T>(fn: () => Promise<T>): Promise<KetQuaNguon<T>> {
  try {
    return { trang_thai: "ok", ...(await fn()) };
  } catch (e) {
    return { trang_thai: "loi", loi: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

export async function nguonLinhKienApp(env: Env, ma: string) {
  if (!env.LINHKIEN_API_KEY) return { trang_thai: "chua_cau_hinh" } as const;
  const g = <T>(p: string) => goi<T>(env.LINHKIEN_BASE_URL, env.LINHKIEN_API_KEY!, env.LINHKIEN_SERVICE, `/api/partner${p}`);
  const m = encodeURIComponent(ma);
  return boc(async () => {
    // Goi song song; 1 API loi (vd ban linh-kien-app chua co API do) -> chi phan do null + ghi loi.
    const [chiTiet, lichSu, thieuHang, khaDung] = await Promise.allSettled([
      g<{ rows: unknown[] }>(`/v1/linh-kien/chi-tiet?ma=${m}`),
      g<{ orders: unknown[]; thieu_lk: unknown[] }>(`/v1/linh-kien/lich-su?ma=${m}&limit=100`),
      g<{ rows: unknown[] }>(`/v1/thieu-hang?ma=${m}&trang_thai=tat_ca&limit=200`),
      g<{ rows: unknown[]; phien_ban_ton_kho: string | null }>(`/v1/ton-kho-kha-dung?ma=${m}`),
    ]);
    const lay = <T>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);
    const loi = [chiTiet, lichSu, thieuHang, khaDung].flatMap((r, i) => (r.status === "rejected" ? [`${["chi-tiet", "lich-su", "thieu-hang", "ton-kho-kha-dung"][i]}: ${String(r.reason?.message ?? r.reason)}`] : []));
    if (loi.length === 4) throw new Error(loi[0]);
    return {
      chi_tiet: lay(chiTiet)?.rows?.[0] ?? null,
      don_hang: lay(lichSu)?.orders ?? null,
      thieu_hang: lay(thieuHang)?.rows ?? lay(lichSu)?.thieu_lk ?? null,
      kha_dung: lay(khaDung)?.rows ?? null,
      loi_mot_phan: loi,
    };
  });
}

export async function nguonDvbh(env: Env, ma: string) {
  if (!env.DVBH_API_KEY) return { trang_thai: "chua_cau_hinh" } as const;
  return boc(() =>
    goi<{ total: number; rows: unknown[]; generated_at: string }>(env.DVBH_BASE_URL, env.DVBH_API_KEY!, env.DVBH_SERVICE, `/api/partner/thieu-linh-kien?ma_lk=${encodeURIComponent(ma)}&pageSize=1000`).then(
      (r) => ({ total: r.total, ca: r.rows, luc: r.generated_at }),
    ),
  );
}
