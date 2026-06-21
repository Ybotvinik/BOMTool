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
  projectId?: number;
  userId?: number;
}): Promise<T> {
  const path = "/api/bom-import/preview";
  const form = new FormData();
  if (opts.file) form.append("file", opts.file);
  if (opts.filePath) form.append("file_path", opts.filePath);
  if (opts.headerRowIndex != null)
    form.append("header_row_index", String(opts.headerRowIndex));
  if (opts.sheetName) form.append("sheet_name", opts.sheetName);
  if (opts.projectId != null) form.append("project_id", String(opts.projectId));
  const headers: Record<string, string> = {};
  if (opts.userId != null) headers["X-User-Id"] = String(opts.userId);
  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: form });
  if (!res.ok) await parseError(res, path, "POST");
  return res.json() as Promise<T>;
}

// China-quote preview (Excel upload + header detection + mapping).
export async function apiChinaPreview<T>(opts: {
  file?: File;
  fileId?: string;
  projectId?: number;
  bomVersionId?: number;
  headerRowIndex?: number;
  sheetName?: string;
  userId?: number;
}): Promise<T> {
  const path = "/api/china-quotes/upload-preview";
  const form = new FormData();
  if (opts.file) form.append("file", opts.file);
  if (opts.fileId) form.append("file_id", opts.fileId);
  if (opts.projectId != null) form.append("project_id", String(opts.projectId));
  if (opts.bomVersionId != null) form.append("bom_version_id", String(opts.bomVersionId));
  if (opts.headerRowIndex != null) form.append("header_row_index", String(opts.headerRowIndex));
  if (opts.sheetName) form.append("sheet_name", opts.sheetName);
  const headers: Record<string, string> = {};
  if (opts.userId != null) headers["X-User-Id"] = String(opts.userId);
  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: form });
  if (!res.ok) await parseError(res, path, "POST");
  return res.json() as Promise<T>;
}

export async function apiEastQuoteUpload<T>(opts: {
  file: File;
  projectId: number;
  bomVersionId: number;
  supplierName?: string;
  replaceExisting?: boolean;
  quoteIdToReplace?: number;
  userId?: number;
}): Promise<T> {
  const path = "/api/official-pricing/east-quotes/upload";
  const form = new FormData();
  form.append("file", opts.file);
  form.append("project_id", String(opts.projectId));
  form.append("bom_version_id", String(opts.bomVersionId));
  if (opts.supplierName?.trim()) {
    form.append("supplier_name", opts.supplierName.trim());
  }
  form.append("replace_existing", String(opts.replaceExisting ?? false));
  if (opts.quoteIdToReplace != null) {
    form.append("quote_id_to_replace", String(opts.quoteIdToReplace));
  }
  const headers: Record<string, string> = {};
  if (opts.userId != null) headers["X-User-Id"] = String(opts.userId);
  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: form });
  if (!res.ok) await parseError(res, path, "POST");
  return res.json() as Promise<T>;
}

/** POST that returns a binary file (e.g. Excel export). */
export async function apiDownloadPost(
  path: string,
  body: unknown,
  userId?: number,
): Promise<{ blob: Blob; fileName: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userId != null) headers["X-User-Id"] = String(userId);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, path, "POST");
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(cd);
  const fileName = match?.[1] ?? "export.xlsx";
  const blob = await res.blob();
  return { blob, fileName };
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
