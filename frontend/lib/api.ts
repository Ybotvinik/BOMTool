// Thin API client for the FastAPI backend. The current user id is forwarded
// via the X-User-Id header so the backend can attribute activity_log entries.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  userId?: number,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userId != null) headers["X-User-Id"] = String(userId);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
