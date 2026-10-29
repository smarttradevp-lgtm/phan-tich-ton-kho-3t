import { Hono } from "hono";
import type { AppEnv } from "../types";
import { canVaiTro } from "../middleware/session";
import { nowVN } from "../lib/vnTime";
import { lenhNhatKy } from "../lib/nhatKy";

// Quan ly tai khoan - chi Admin.
const users = new Hono<AppEnv>();
users.use("*", canVaiTro("admin"));

const VAI_TRO = ["admin", "nhap_lieu", "xem"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

users.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT email, ten, vai_tro, trang_thai, created_at, updated_at FROM users ORDER BY trang_thai, email").all();
  return c.json({ rows: results });
});

// Them truoc tai khoan (da duyet) - nguoi do dang nhap Google lan dau la vao duoc ngay.
users.post("/", async (c) => {
  const b = await c.req.json<{ email?: string; ten?: string; vai_tro?: string }>();
  const email = (b.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return c.json({ error: "EMAIL_KHONG_HOP_LE" }, 400);
  if (!VAI_TRO.includes(b.vai_tro ?? "xem")) return c.json({ error: "INVALID_VAI_TRO" }, 400);
  const db = c.env.DB;
  const r = await db.batch([
    db.prepare("INSERT OR IGNORE INTO users (email, ten, vai_tro, trang_thai) VALUES (?, ?, ?, 'da_duyet')").bind(email, b.ten?.trim() || null, b.vai_tro ?? "xem"),
    lenhNhatKy(db, c.get("user").email, "Thêm tài khoản", { email, vai_tro: b.vai_tro ?? "xem" }),
  ]);
  if (!r[0].meta.changes) return c.json({ error: "DA_CO" }, 409);
  return c.json({ ok: true });
});

users.patch("/:email", async (c) => {
  const email = c.req.param("email").toLowerCase();
  const body = await c.req.json<{ vai_tro?: string; trang_thai?: string; ten?: string }>();
  if (email === c.get("user").email) return c.json({ error: "KHONG_TU_SUA" }, 400);
  if (body.vai_tro && !VAI_TRO.includes(body.vai_tro)) return c.json({ error: "INVALID_VAI_TRO" }, 400);
  if (body.trang_thai && !["cho_duyet", "da_duyet", "khoa"].includes(body.trang_thai)) return c.json({ error: "INVALID_TRANG_THAI" }, 400);
  const db = c.env.DB;
  // Khoa tai khoan -> tang phien ban phien = dang xuat moi thiet bi.
  const r = await db.batch([
    db.prepare(
      `UPDATE users SET vai_tro = COALESCE(?, vai_tro), trang_thai = COALESCE(?, trang_thai), ten = COALESCE(?, ten), updated_at = ?,
         phien_ban_phien = phien_ban_phien + CASE WHEN ? = 'khoa' THEN 1 ELSE 0 END
       WHERE email = ?`,
    ).bind(body.vai_tro ?? null, body.trang_thai ?? null, body.ten?.trim() || null, nowVN(), body.trang_thai ?? null, email),
    lenhNhatKy(db, c.get("user").email, "Sửa tài khoản", { email, ...body }),
  ]);
  if (!r[0].meta.changes) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

// Dang xuat moi thiet bi cua 1 tai khoan (tang phien ban phien).
users.post("/:email/dang-xuat", async (c) => {
  const email = c.req.param("email").toLowerCase();
  const db = c.env.DB;
  const r = await db.batch([
    db.prepare("UPDATE users SET phien_ban_phien = phien_ban_phien + 1, updated_at = ? WHERE email = ?").bind(nowVN(), email),
    lenhNhatKy(db, c.get("user").email, "Đăng xuất mọi thiết bị", { email }),
  ]);
  if (!r[0].meta.changes) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

users.delete("/:email", async (c) => {
  const email = c.req.param("email").toLowerCase();
  if (email === c.get("user").email) return c.json({ error: "KHONG_TU_SUA" }, 400);
  const db = c.env.DB;
  const r = await db.batch([db.prepare("DELETE FROM users WHERE email = ?").bind(email), lenhNhatKy(db, c.get("user").email, "Xoá tài khoản", { email })]);
  if (!r[0].meta.changes) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

export default users;
