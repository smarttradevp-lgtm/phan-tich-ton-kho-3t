// "Kho du lieu MISA goc" (docs/KE_HOACH_KHO_MISA.md): cong tac nguon ton kho + bao cac he thong khac khi co phien moi.
import type { Env } from "../types";
import { nowVN } from "./vnTime";

// app_settings 'hub_la_nguon_ton' = '1' -> app nay la nguon ton kho: KHONG keo ton tu linh-kien-app nua (tranh vong
// app nay nhap -> linh-kien-app keo -> app nay keo lai). Mac dinh (chua co dong) = van keo nhu cu (giai doan chay song song).
export async function hubLaNguonTon(db: D1Database): Promise<boolean> {
  return (await db.prepare("SELECT value FROM app_settings WHERE key = 'hub_la_nguon_ton'").first<string>("value")) === "1";
}

// Bao linh-kien-app "co phien ton kho moi" -> ben do keo ngay (POST /api/hub-misa/thong-bao, header X-Sync-Key).
// Loi thi chi ghi lai: linh-kien-app con cron kiem tra phien ban moi gio.
export async function baoPhienTonMoi(env: Env, phienBan: string): Promise<void> {
  if (!env.HUB_SYNC_KEY) return;
  let ketQua: string;
  try {
    const req = new Request(new URL("/api/hub-misa/thong-bao", env.LINHKIEN_BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sync-Key": env.HUB_SYNC_KEY },
      body: JSON.stringify({ phien_ban: phienBan }),
      signal: AbortSignal.timeout(10000),
    });
    const res = env.LINHKIEN_SERVICE ? await env.LINHKIEN_SERVICE.fetch(req) : await fetch(req);
    ketQua = res.ok ? "ok" : `HTTP ${res.status}`;
  } catch (e) {
    ketQua = String((e as Error)?.message ?? e).slice(0, 200);
  }
  await env.DB.prepare(
    "INSERT INTO app_settings (key, value, updated_at) VALUES ('thong_bao_phien_ton', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  )
    .bind(JSON.stringify({ phien_ban: phienBan, linh_kien_app: ketQua }), nowVN())
    .run();
}
