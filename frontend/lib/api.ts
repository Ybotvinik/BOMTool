// Thin API client for the FastAPI backend. The current user id is forwarded
// via the X-User-Id header so the backend can attribute activity_log entries.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function parseError(res: Response, path: string, method: string): Promise<never> {
  let detail = "";
  try {
    const data = await res.json();
    detail = typeof data?.detail === "string" ? `: ${data.detail}` : "";
  } catch {
    /* ignore */
  }
  throw new Error(`${method} ${path} failed (${res.status})${detail}`);
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
  if (!res.ok) await parseError(res, path, "POST");
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  userId?: number,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userId != null) headers["X-User-Id"] = String(userId);
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, path, "PATCH");
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string, userId?: number): Promise<void> {
  const headers: Record<string, string> = {};
  if (userId != null) headers["X-User-Id"] = String(userId);
  const res = await fetch(`${API_URL}${path}`, { method: "DELETE", headers });
  if (!res.ok) await parseError(res, path, "DELETE");
}

export async function apiUpload<T>(
  path: string,
  file: File,
  userId?: number,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (userId != null) headers["X-User-Id"] = String(userId);
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) await parseError(res, path, "POST");
  return res.json() as Promise<T>;
}

// BOM preview supports either a fresh file upload or re-previewing a stored file
// (file_path) with an optional header-row / sheet override.
export async function apiBomPreview<T>(opts: {
  file?: File;
  filePath?: string;
  headerRowIndex?: number;
  sheetName?: string;
  userId?: number;
}): Promise<T> {
  const path = "/api/bom-import/preview";
  const form = new FormData();
  if (opts.file) form.append("file", opts.file);
  if (opts.filePath) form.append("file_path", opts.filePath);
  if (opts.headerRowIndex != null)
    form.append("header_row_index", String(opts.headerRowIndex));
  if (opts.sheetName) form.append("sheet_name", opts.sheetName);
  const headers: Record<string, string> = {};
  if (opts.userId != null) headers["X-User-Id"] = String(opts.userId);
  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: form });
  if (!res.ok) await parseError(res, path, "POST");
  return res.json() as Promise<T>;
}
