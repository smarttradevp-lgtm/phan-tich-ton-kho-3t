export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // Service Binding toi Worker linh-kien-app (tuy chon - khong co thi goi LINHKIEN_BASE_URL qua mang).
  LINHKIEN_SERVICE?: Fetcher;
  LINHKIEN_BASE_URL: string;
  LINHKIEN_API_KEY?: string;
  // App DVBH (ca dang bao thieu linh kien - Hồ sơ linh kiện). Khong co khoa -> hien "chua ket noi".
  DVBH_SERVICE?: Fetcher;
  DVBH_BASE_URL: string;
  DVBH_API_KEY?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  FRONTEND_URL: string;
  SESSION_SECRET: string;
  BOOTSTRAP_ADMIN_EMAIL: string;
  DEV_LOGIN?: string; // "1" = bat /api/auth/dev-login (chi .dev.vars, chi localhost)
}

export type VaiTro = "admin" | "nhap_lieu" | "xem";

export interface User {
  email: string;
  ten: string | null;
  vai_tro: VaiTro;
  trang_thai: "cho_duyet" | "da_duyet" | "khoa";
  phien_ban_phien: number;
}

export interface Vars {
  requestId: string;
  email: string;
  sessionPv: number;
  user: User;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
