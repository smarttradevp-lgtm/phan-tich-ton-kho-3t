import { Hono } from "hono";
import type { AppEnv, Env } from "./types";
import authRoutes from "./routes/auth";
import usersRoutes from "./routes/users";
import baoCaoRoutes from "./routes/baoCao";
import caiDatRoutes from "./routes/caiDat";
import importRoutes from "./routes/importDuLieu";
import dongBoRoutes from "./routes/dongBo";
import { xacThucPhien, napNguoiDung } from "./middleware/session";
import { chayDongBo } from "./lib/dongBoLinhKien";
import { chotThangTinh } from "./lib/chotThang";

// "Phan tich ton kho 3T" - 1 Worker phuc vu ca API (/api/*) lan frontend build tinh. Logic: docs/DAC_TA_LOGIC.md.
const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
});

// Header bao mat cho API + chan request GHI tu site khac (cookie SameSite=Lax khong du voi app anh em *.workers.dev).
app.use("/api/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const site = c.req.header("Sec-Fetch-Site");
    const origin = c.req.header("Origin");
    const cungOrigin = site ? site === "same-origin" || site === "none" : !origin || origin === new URL(c.req.url).origin;
    if (!cungOrigin) return c.json({ error: "YEU_CAU_TU_SITE_KHAC" }, 403);
  }
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Cache-Control", "no-store");
});

app.route("/api/auth", authRoutes);

// Moi API con lai: can dang nhap + tai khoan da duyet.
app.use("/api/*", xacThucPhien, napNguoiDung);
app.route("/api/users", usersRoutes);
app.route("/api/bao-cao", baoCaoRoutes);
app.route("/api/cai-dat", caiDatRoutes);
app.route("/api/import", importRoutes);
app.route("/api/dong-bo", dongBoRoutes);

app.onError((err, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  console.error(`[${requestId}]`, err);
  return c.json({ error: "INTERNAL_ERROR", requestId }, 500);
});

app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  // Cron moi gio: ton kho (re - chi keo khi phien ban ben linh-kien-app doi). 1h sang VN (18h UTC): danh muc + danh ba +
  // chot tinh thang.
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    const dem = new Date(event.scheduledTime).getUTCHours() === 18;
    ctx.waitUntil(
      chayDongBo(env, { tonKho: true, danhMuc: dem })
        .then(() => (dem ? chotThangTinh(env.DB) : undefined))
        .then(() => undefined)
        .catch((err) => console.error("[cron]", err)),
    );
  },
};
