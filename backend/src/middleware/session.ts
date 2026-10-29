import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { verifySession, signSession } from "../lib/jwt";
import type { AppEnv, User, VaiTro } from "../types";

export const SESSION_COOKIE = "ptk_session";
export const SESSION_TTL_SECONDS = 72 * 60 * 60;

export function datCookiePhien(c: Context<AppEnv>, token: string) {
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: SESSION_TTL_SECONDS, path: "/" });
}

// Xac thuc cookie phien (JWT HS256) + gia han khi con duoi 1/2 thoi gian song (cung co che linh-kien-app).
export async function xacThucPhien(c: Context<AppEnv>, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "MISSING_TOKEN" }, 401);
  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: "INVALID_TOKEN" }, 401);
  c.set("email", payload.email);
  c.set("sessionPv", payload.pv ?? 0);
  if (payload.exp - Math.floor(Date.now() / 1000) < SESSION_TTL_SECONDS / 2) {
    datCookiePhien(c, await signSession({ email: payload.email, pv: payload.pv ?? 0 }, c.env.SESSION_SECRET, SESSION_TTL_SECONDS));
  }
  await next();
}

// Nap tai khoan; chi tai khoan 'da_duyet' va dung phien ban phien moi qua.
export async function napNguoiDung(c: Context<AppEnv>, next: Next) {
  const user = await c.env.DB.prepare("SELECT email, ten, vai_tro, trang_thai, phien_ban_phien FROM users WHERE email = ?")
    .bind(c.get("email"))
    .first<User>();
  if (!user) return c.json({ error: "USER_NOT_FOUND" }, 401);
  if (user.phien_ban_phien !== c.get("sessionPv")) return c.json({ error: "PHIEN_DA_THU_HOI" }, 401);
  if (user.trang_thai === "khoa") return c.json({ error: "DISABLED" }, 403);
  if (user.trang_thai !== "da_duyet") return c.json({ error: "CHO_DUYET" }, 403);
  c.set("user", user);
  await next();
}

const THU_BAC: Record<VaiTro, number> = { xem: 0, nhap_lieu: 1, admin: 2 };

// Can vai tro toi thieu (admin > nhap_lieu > xem).
export function canVaiTro(toiThieu: VaiTro) {
  return async (c: Context<AppEnv>, next: Next) => {
    if (THU_BAC[c.get("user").vai_tro] < THU_BAC[toiThieu]) return c.json({ error: "FORBIDDEN_ROLE" }, 403);
    await next();
  };
}
