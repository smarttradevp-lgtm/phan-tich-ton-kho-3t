import { Hono } from "hono";
import type { AppEnv } from "../types";
import { canVaiTro } from "../middleware/session";
import { chayDongBo } from "../lib/dongBoLinhKien";
import { chotThangTinh } from "../lib/chotThang";

const dongBo = new Hono<AppEnv>();

dongBo.get("/trang-thai", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT key, value, updated_at FROM app_settings WHERE key LIKE 'dong_bo_%'").all<{ key: string; value: string; updated_at: string }>();
  return c.json(Object.fromEntries(results.map((r) => [r.key.replace("dong_bo_", ""), { ...JSON.parse(r.value), updated_at: r.updated_at }])));
});

// Nut "Dong bo ngay" (Admin / nhap lieu). ep_buoc = keo lai ton kho du phien ban chua doi.
dongBo.post("/chay", canVaiTro("nhap_lieu"), async (c) => {
  const b = await c.req.json<{ ton_kho?: boolean; danh_muc?: boolean; ep_buoc?: boolean }>().catch(() => ({}) as Record<string, boolean>);
  return c.json(await chayDongBo(c.env, { tonKho: b.ton_kho !== false, danhMuc: b.danh_muc !== false, epBuoc: !!b.ep_buoc }));
});

dongBo.post("/chot-thang", canVaiTro("nhap_lieu"), async (c) => c.json({ da_chot: await chotThangTinh(c.env.DB) }));

export default dongBo;
