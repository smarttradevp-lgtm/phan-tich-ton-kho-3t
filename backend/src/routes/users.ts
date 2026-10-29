import { Hono } from "hono";
import type { AppEnv } from "../types";
import { canVaiTro } from "../middleware/session";
import { nowVN } from "../lib/vnTime";

// Quan ly tai khoan - chi Admin.
const users = new Hono<AppEnv>();
users.use("*", canVaiTro("admin"));

users.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT email, ten, vai_tro, trang_thai, created_at, updated_at FROM users ORDER BY trang_thai, email").all();
  return c.json({ rows: results });
});

users.patch("/:email", async (c) => {
  const email = c.req.param("email").toLowerCase();
  const body = await c.req.json<{ vai_tro?: string; trang_thai?: string }>();
  if (email === c.get("user").email) return c.json({ error: "KHONG_TU_SUA" }, 400);
  if (body.vai_tro && !["admin", "nhap_lieu", "xem"].includes(body.vai_tro)) return c.json({ error: "INVALID_VAI_TRO" }, 400);
  if (body.trang_thai && !["cho_duyet", "da_duyet", "khoa"].includes(body.trang_thai)) return c.json({ error: "INVALID_TRANG_THAI" }, 400);
  // Khoa tai khoan -> tang phien ban phien = dang xuat moi thiet bi.
  const r = await c.env.DB.prepare(
    `UPDATE users SET vai_tro = COALESCE(?, vai_tro), trang_thai = COALESCE(?, trang_thai), updated_at = ?,
       phien_ban_phien = phien_ban_phien + CASE WHEN ? = 'khoa' THEN 1 ELSE 0 END
     WHERE email = ?`,
  )
    .bind(body.vai_tro ?? null, body.trang_thai ?? null, nowVN(), body.trang_thai ?? null, email)
    .run();
  if (!r.meta.changes) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

export default users;
