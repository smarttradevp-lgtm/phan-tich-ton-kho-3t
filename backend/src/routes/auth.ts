import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { signSession } from "../lib/jwt";
import { nowVN } from "../lib/vnTime";
import { xacThucPhien, datCookiePhien, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../middleware/session";

const STATE_COOKIE = "ptk_oauth_state";
const auth = new Hono<AppEnv>();

auth.get("/login", (c) => {
  const state = crypto.randomUUID();
  setCookie(c, STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 600, path: "/" });
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: c.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const saved = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });
  if (!code || !state || state !== saved) return c.text("Xác thực thất bại: state không hợp lệ.", 400);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: c.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return c.text("Không đổi được mã xác thực với Google.", 502);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!infoRes.ok) return c.text("Không lấy được thông tin người dùng từ Google.", 502);
  const info = (await infoRes.json()) as { email: string; email_verified: boolean; name?: string };
  if (!info.email_verified) return c.text("Email Google chưa được xác minh.", 403);

  const email = info.email.trim().toLowerCase();
  const laAdminGoc = email === c.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  // Tai khoan moi = 'cho_duyet' (Admin duyet o man Nguoi dung); BOOTSTRAP_ADMIN_EMAIL tu thanh admin da duyet.
  await c.env.DB.prepare(
    `INSERT INTO users (email, ten, vai_tro, trang_thai) VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET ten = excluded.ten, updated_at = ?,
       vai_tro = CASE WHEN ? THEN 'admin' ELSE vai_tro END,
       trang_thai = CASE WHEN ? THEN 'da_duyet' ELSE trang_thai END`,
  )
    .bind(email, info.name ?? null, laAdminGoc ? "admin" : "xem", laAdminGoc ? "da_duyet" : "cho_duyet", nowVN(), laAdminGoc ? 1 : 0, laAdminGoc ? 1 : 0)
    .run();
  const pv = (await c.env.DB.prepare("SELECT phien_ban_phien FROM users WHERE email = ?").bind(email).first<number>("phien_ban_phien")) ?? 0;
  datCookiePhien(c, await signSession({ email, pv }, c.env.SESSION_SECRET, SESSION_TTL_SECONDS));
  return c.redirect(c.env.FRONTEND_URL || "/");
});

// CHI de chay demo / dev local: bat bang DEV_LOGIN=1 trong .dev.vars (khong bao gio dat o wrangler.jsonc) va chi nhan
// request toi localhost. Dang nhap thang bang email ?email= (tao admin da duyet neu chua co).
auth.get("/dev-login", async (c) => {
  const host = new URL(c.req.url).hostname;
  if (c.env.DEV_LOGIN !== "1" || !["localhost", "127.0.0.1"].includes(host)) return c.json({ error: "NOT_FOUND" }, 404);
  const email = (c.req.query("email") || c.env.BOOTSTRAP_ADMIN_EMAIL).trim().toLowerCase();
  await c.env.DB.prepare("INSERT OR IGNORE INTO users (email, ten, vai_tro, trang_thai) VALUES (?, 'Dev', 'admin', 'da_duyet')").bind(email).run();
  const pv = (await c.env.DB.prepare("SELECT phien_ban_phien FROM users WHERE email = ?").bind(email).first<number>("phien_ban_phien")) ?? 0;
  datCookiePhien(c, await signSession({ email, pv }, c.env.SESSION_SECRET, SESSION_TTL_SECONDS));
  return c.redirect("/");
});

auth.post("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// Tra ca tai khoan cho duyet / bi khoa de FE hien man phu hop (khong dung napNguoiDung).
auth.get("/me", xacThucPhien, async (c) => {
  const user = await c.env.DB.prepare("SELECT email, ten, vai_tro, trang_thai, phien_ban_phien FROM users WHERE email = ?")
    .bind(c.get("email"))
    .first<{ email: string; ten: string | null; vai_tro: string; trang_thai: string; phien_ban_phien: number }>();
  if (!user || user.phien_ban_phien !== c.get("sessionPv")) return c.json({ error: "INVALID_TOKEN" }, 401);
  const { phien_ban_phien: _pv, ...rest } = user;
  return c.json(rest);
});

export default auth;
