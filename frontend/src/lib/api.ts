export class ApiError extends Error {
  constructor(public status: number, public code: string, public body: unknown) {
    super(code);
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string } | null)?.error ?? `HTTP_${res.status}`, body);
  return body as T;
}

export const fmtSo = (v: number | null | undefined, phanThapPhan = 0) =>
  v == null || !Number.isFinite(v) ? "" : v.toLocaleString("vi-VN", { maximumFractionDigits: phanThapPhan });

export const fmtThang = (t: string) => `${t.slice(4, 6)}/${t.slice(0, 4)}`;
