"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  GitCompare,
  Loader2,
  RefreshCw,
  Star,
  Table2,
  Trash2,
  Upload,
  DollarSign,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { qualityScoreTone } from "@/components/bom/types";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import {
  fmtDate,
  versionDisplayName,
  type VersionCatalogResponse,
} from "./types";

type ApiProject = { id: number; name: string };

const PROJECT_KEY = "glintech.versions.projectId";

function readSavedProjectId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function saveProjectId(id: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECT_KEY, String(id));
}

export function BomVersionsPanel({
  projectId,
  onProjectChange,
  onCompareWith,
}: {
  projectId: number | null;
  onProjectChange: (id: number) => void;
  onCompareWith: (targetVersionId: number) => void;
}) {
  const { user } = useCurrentUser();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [catalog, setCatalog] = useState<VersionCatalogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects").then(setProjects).catch(() => setProjects([]));
  }, []);

  const loadCatalog = useCallback(async () => {
    if (projectId == null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<VersionCatalogResponse>(
        `/api/bom-versions/catalog?project_id=${projectId}`,
      );
      setCatalog(data);
    } catch (e) {
      setCatalog(null);
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  async function activate(versionId: number) {
    setBusyId(versionId);
    setError(null);
    try {
      await apiPost(`/api/bom-versions/${versionId}/activate`, {}, user.id);
      await loadCatalog();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(versionId: number, label: string) {
    if (!window.confirm(`למחוק את גרסת BOM "${label}"? פעולה זו בלתי הפיכה.`)) return;
    setBusyId(versionId);
    setError(null);
    try {
      await apiDelete(`/api/bom-versions/${versionId}`, user.id);
      await loadCatalog();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusyId(null);
    }
  }

  const activeVersion = catalog?.versions.find((v) => v.is_project_active) ?? null;

  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <select
          className="h-8 min-w-[200px] rounded-md border border-slate-200 px-2 text-[12px] bg-white"
          value={projectId ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (Number.isFinite(id)) {
              saveProjectId(id);
              onProjectChange(id);
            }
          }}
        >
          <option value="">בחר פרויקט…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={loading || projectId == null}
          onClick={() => loadCatalog()}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-slate-200 text-[11px] bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          רענון
        </button>
        {projectId != null && (
          <Link
            href={`/upload-bom?project_id=${projectId}`}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-brand/30 text-[11px] bg-brand-soft text-brand hover:bg-brand/10"
          >
            <Upload className="w-3.5 h-3.5" /> טען BOM חדש
          </Link>
        )}
      </div>

      {error && (
        <div className="px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-800 text-[11px]">
          {error}
        </div>
      )}

      {!projectId ? (
        <Card className="p-8 text-center text-[13px] text-slate-500">בחר פרויקט כדי לראות גרסאות BOM</Card>
      ) : loading && !catalog ? (
        <div className="py-12 text-center text-slate-500 text-[13px]">
          <Loader2 className="w-5 h-5 animate-spin inline-block ml-2" />
          טוען גרסאות…
        </div>
      ) : catalog ? (
        <>
          <Card className="p-3 shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-[11px]">
              <div>
                <div className="text-slate-500">פרויקט</div>
                <div className="font-bold text-navy truncate">{catalog.project_name}</div>
              </div>
              <div>
                <div className="text-slate-500">לקוח</div>
                <div className="font-medium truncate">{catalog.customer_name ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">גרסה פעילה</div>
                <div className="font-medium truncate">
                  {activeVersion ? versionDisplayName(activeVersion) : "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500">סה״כ גרסאות</div>
                <div className="font-bold tabular-nums">{catalog.total_versions}</div>
              </div>
              <div>
                <div className="text-slate-500">העלאה אחרונה</div>
                <div className="font-medium">{fmtDate(catalog.last_uploaded_at)}</div>
              </div>
              <div>
                <div className="text-slate-500">שורות בגרסה פעילה</div>
                <div className="font-bold tabular-nums">{activeVersion?.total_lines ?? "—"}</div>
              </div>
            </div>
          </Card>

          {catalog.versions.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-[13px] text-slate-600">אין גרסאות BOM לפרויקט זה</p>
              <Link
                href={`/upload-bom?project_id=${projectId}`}
                className="inline-flex items-center gap-1 mt-3 h-8 px-3 rounded-md border border-brand/30 text-[12px] bg-brand-soft text-brand"
              >
                <Upload className="w-3.5 h-3.5" /> טען גרסת BOM ראשונה
              </Link>
            </Card>
          ) : (
            <div className="grid gap-2 overflow-y-auto min-h-0">
              {catalog.versions.map((v) => {
                const label = versionDisplayName(v);
                const isActive = v.is_project_active;
                const busy = busyId === v.id;
                return (
                  <Card
                    key={v.id}
                    className={`p-3 ${isActive ? "border-brand/40 bg-brand-soft/30 ring-1 ring-brand/20" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-bold text-navy">{label}</span>
                          {isActive && (
                            <Badge className="bg-brand-soft text-brand border-brand/30">
                              <Star className="w-3 h-3 ml-1 fill-current" /> פעילה
                            </Badge>
                          )}
                          {v.is_active && !isActive && (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200">מסומן פעיל</Badge>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>הועלה: {fmtDate(v.imported_at ?? v.created_at)}</span>
                          {v.source_file_name && <span className="truncate max-w-[240px]">קובץ: {v.source_file_name}</span>}
                          {v.notes && <span className="truncate max-w-[200px]">הערות: {v.notes}</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        <Badge className="bg-white text-slate-700 border-slate-200">{v.total_lines} שורות</Badge>
                        <Badge className="bg-white text-slate-600 border-slate-200">DNP: {v.dnp_count}</Badge>
                        <Badge className="bg-white text-slate-600 border-slate-200">פעילות: {v.non_dnp_count}</Badge>
                        {v.quality_score != null && (
                          <Badge
                            className={
                              qualityScoreTone(v.quality_score) === "good"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : qualityScoreTone(v.quality_score) === "warn"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                            }
                          >
                            איכות: {Math.round(v.quality_score)}
                          </Badge>
                        )}
                        {v.needs_review_count > 0 && (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-200">
                            בדיקה: {v.needs_review_count}
                          </Badge>
                        )}
                        {v.pricing_snapshot_count > 0 && (
                          <Badge className="bg-violet-50 text-violet-700 border-violet-200">
                            Snapshots: {v.pricing_snapshot_count}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {!isActive && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => activate(v.id)}
                          className="h-7 px-2 rounded-md border border-brand/30 text-[11px] text-brand bg-white hover:bg-brand-soft disabled:opacity-50"
                        >
                          הפוך לפעילה
                        </button>
                      )}
                      <Link
                        href={`/bom?project_id=${projectId}&version_id=${v.id}`}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 text-[11px] bg-white hover:bg-slate-50"
                      >
                        <Table2 className="w-3 h-3" /> פתח טבלת BOM
                      </Link>
                      <Link
                        href={`/official-pricing?project_id=${projectId}&version_id=${v.id}`}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 text-[11px] bg-white hover:bg-slate-50"
                      >
                        <DollarSign className="w-3 h-3" /> פתח מחירון ספקים
                      </Link>
                      <button
                        type="button"
                        onClick={() => onCompareWith(v.id)}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 text-[11px] bg-white hover:bg-slate-50"
                      >
                        <GitCompare className="w-3 h-3" /> השווה מול גרסה אחרת
                      </button>
                      <button
                        type="button"
                        disabled={busy || isActive}
                        title={isActive ? "לא ניתן למחוק גרסה פעילה" : undefined}
                        onClick={() => remove(v.id, label)}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-red-200 text-[11px] text-red-700 bg-white hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 className="w-3 h-3" /> מחק
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

export { readSavedProjectId, saveProjectId };
