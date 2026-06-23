"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GitCompare, Loader2, Search, Upload } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { apiGet } from "@/lib/api";
import {
  COMPARE_FILTERS,
  changeTypeLabel,
  changeTypeTone,
  matchesCompareFilter,
  versionDisplayName,
  type CompareFilterKey,
  type CompareResponse,
  type VersionCatalogItem,
  type VersionCatalogResponse,
} from "./types";

type ApiProject = { id: number; name: string };

function CompactKpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "good" | "bad" | "warn" | "muted";
}) {
  const toneClass = {
    default: "text-slate-800",
    good: "text-green-700",
    bad: "text-red-700",
    warn: "text-amber-700",
    muted: "text-slate-500",
  }[tone];
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] whitespace-nowrap">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

export function BomComparePanel({
  projectId,
  onProjectChange,
  initialBaseId,
  initialTargetId,
}: {
  projectId: number | null;
  onProjectChange: (id: number) => void;
  initialBaseId?: number | null;
  initialTargetId?: number | null;
}) {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [versions, setVersions] = useState<VersionCatalogItem[]>([]);
  const [baseId, setBaseId] = useState<number | null>(initialBaseId ?? null);
  const [targetId, setTargetId] = useState<number | null>(initialTargetId ?? null);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [filter, setFilter] = useState<CompareFilterKey>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects").then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (initialBaseId != null) setBaseId(initialBaseId);
  }, [initialBaseId]);

  useEffect(() => {
    if (initialTargetId != null) setTargetId(initialTargetId);
  }, [initialTargetId]);

  const loadVersions = useCallback(async () => {
    if (projectId == null) {
      setVersions([]);
      return;
    }
    try {
      const catalog = await apiGet<VersionCatalogResponse>(
        `/api/bom-versions/catalog?project_id=${projectId}`,
      );
      setVersions(catalog.versions);
    } catch {
      setVersions([]);
    }
  }, [projectId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  useEffect(() => {
    if (versions.length < 2) return;
    if (initialBaseId != null || initialTargetId != null) return;
    const sorted = [...versions].sort((a, b) => b.id - a.id);
    const active = sorted.find((v) => v.is_project_active) ?? sorted[0];
    const prev = sorted.find((v) => v.id < active.id) ?? sorted[1];
    setBaseId((cur) => cur ?? prev?.id ?? sorted[1]?.id ?? null);
    setTargetId((cur) => cur ?? active?.id ?? sorted[0]?.id ?? null);
  }, [versions, initialBaseId, initialTargetId]);

  const canCompare = projectId != null && baseId != null && targetId != null && baseId !== targetId;
  const needsMoreVersions = versions.length < 2;

  async function runCompare() {
    if (!canCompare || projectId == null || baseId == null || targetId == null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<CompareResponse>(
        `/api/bom-versions/compare?project_id=${projectId}&base_version_id=${baseId}&target_version_id=${targetId}`,
      );
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setLoading(false);
    }
  }

  function compareActiveVsPrevious() {
    if (versions.length < 2) return;
    const sorted = [...versions].sort((a, b) => b.id - a.id);
    const active = sorted.find((v) => v.is_project_active) ?? sorted[0];
    const prev = sorted.find((v) => v.id < active.id) ?? sorted[1];
    if (prev && active) {
      setBaseId(prev.id);
      setTargetId(active.id);
    }
  }

  useEffect(() => {
    if (canCompare && !needsMoreVersions) {
      runCompare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseId, targetId, projectId]);

  const filtered = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    return result.changes.filter((row) => {
      if (!matchesCompareFilter(row, filter)) return false;
      if (!q) return true;
      const hay = [
        row.designator,
        row.old_mpn,
        row.new_mpn,
        row.old_manufacturer,
        row.new_manufacturer,
        row.old_description,
        row.new_description,
        row.change_type,
      ]
        .map((x) => (x ?? "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [result, filter, query]);

  const sel = "h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white min-w-[140px]";

  return (
    <div className="flex flex-col gap-2 min-h-0 flex-1">
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <select
          className={`${sel} min-w-[200px]`}
          value={projectId ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (Number.isFinite(id)) onProjectChange(id);
          }}
        >
          <option value="">בחר פרויקט…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className={sel}
          value={baseId ?? ""}
          disabled={!projectId || needsMoreVersions}
          onChange={(e) => setBaseId(Number(e.target.value) || null)}
        >
          <option value="">גרסת מקור…</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {versionDisplayName(v)}
            </option>
          ))}
        </select>

        <select
          className={sel}
          value={targetId ?? ""}
          disabled={!projectId || needsMoreVersions}
          onChange={(e) => setTargetId(Number(e.target.value) || null)}
        >
          <option value="">גרסת יעד…</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {versionDisplayName(v)}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={versions.length < 2}
          onClick={compareActiveVsPrevious}
          className="h-8 px-2.5 rounded-md border border-slate-200 text-[11px] bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          השווה פעילה מול קודמת
        </button>

        <button
          type="button"
          disabled={!canCompare || loading}
          onClick={() => runCompare()}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-brand/30 text-[11px] bg-brand-soft text-brand hover:bg-brand/10 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
          השווה
        </button>
      </div>

      {error && (
        <div className="px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-800 text-[11px]">{error}</div>
      )}

      {!projectId ? (
        <Card className="p-8 text-center text-[13px] text-slate-500">בחר פרויקט כדי לראות גרסאות BOM</Card>
      ) : needsMoreVersions ? (
        <Card className="p-8 text-center">
          <p className="text-[13px] text-slate-600">צריך לפחות שתי גרסאות BOM כדי לבצע השוואה</p>
          <Link
            href={`/upload-bom?project_id=${projectId}`}
            className="inline-flex items-center gap-1 mt-3 h-8 px-3 rounded-md border border-brand/30 text-[12px] bg-brand-soft text-brand"
          >
            <Upload className="w-3.5 h-3.5" /> טען גרסת BOM נוספת
          </Link>
        </Card>
      ) : result ? (
        <>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            <CompactKpi label="נוספו" value={result.summary.added} tone="good" />
            <CompactKpi label="הוסרו" value={result.summary.removed} tone="bad" />
            <CompactKpi label="שונו" value={result.summary.changed} tone="warn" />
            <CompactKpi label="שונו כמויות" value={result.summary.qty_changed} tone="warn" />
            <CompactKpi label="שונה MPN" value={result.summary.mpn_changed} tone="warn" />
            <CompactKpi label="שונה יצרן" value={result.summary.manufacturer_changed} tone="warn" />
            <CompactKpi label="DNP השתנה" value={result.summary.dnp_changed} tone="muted" />
            <CompactKpi label="ללא שינוי" value={result.summary.unchanged} tone="muted" />
            <CompactKpi label="דורש בדיקה" value={result.summary.needs_review} tone="warn" />
          </div>

          <div className="text-[11px] text-slate-500 shrink-0">
            מקור: <strong>{versionDisplayName(result.base_version)}</strong>
            {" → "}
            יעד: <strong>{versionDisplayName(result.target_version)}</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex flex-wrap gap-1">
              {COMPARE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`h-7 px-2 rounded-md border text-[11px] ${
                    filter === f.id
                      ? "border-brand/40 bg-brand-soft text-brand"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative mr-auto">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש…"
                className="h-8 w-44 pr-8 pl-2 rounded-md border border-slate-200 text-[12px]"
              />
            </div>
          </div>

          <Card className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="p-2 text-right font-medium w-8">#</th>
                    <th className="p-2 text-right font-medium">סוג שינוי</th>
                    <th className="p-2 text-right font-medium">Designator</th>
                    <th className="p-2 text-right font-medium">MPN ישן</th>
                    <th className="p-2 text-right font-medium">MPN חדש</th>
                    <th className="p-2 text-right font-medium">יצרן ישן</th>
                    <th className="p-2 text-right font-medium">יצרן חדש</th>
                    <th className="p-2 text-right font-medium">Qty ישן</th>
                    <th className="p-2 text-right font-medium">Qty חדש</th>
                    <th className="p-2 text-right font-medium">DNP</th>
                    <th className="p-2 text-right font-medium min-w-[120px]">תיאור</th>
                    <th className="p-2 text-right font-medium">הערות</th>
                    <th className="p-2 text-right font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="p-8 text-center text-slate-500">
                        אין שורות להצגה בסינון הנוכחי
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, idx) => {
                      const lineId = row.target_line_id ?? row.base_line_id;
                      const desc = row.new_description ?? row.old_description;
                      return (
                        <tr key={`${row.base_line_id}-${row.target_line_id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="p-2 text-slate-400 tabular-nums">{idx + 1}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              <Badge className={changeTypeTone(row.change_type)}>
                                {changeTypeLabel(row.change_type)}
                              </Badge>
                              {row.change_flags
                                .filter((f) => f !== row.change_type && f !== "Unchanged")
                                .map((f) => (
                                  <Badge key={f} className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                                    {changeTypeLabel(f)}
                                  </Badge>
                                ))}
                              {row.needs_review && (
                                <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                                  דורש בדיקה
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2 font-mono text-[10px] max-w-[100px] truncate" title={row.designator ?? undefined}>
                            {row.designator ?? "—"}
                          </td>
                          <td className="p-2 max-w-[100px] truncate">{row.old_mpn ?? "—"}</td>
                          <td className="p-2 max-w-[100px] truncate">{row.new_mpn ?? "—"}</td>
                          <td className="p-2 max-w-[80px] truncate">{row.old_manufacturer ?? "—"}</td>
                          <td className="p-2 max-w-[80px] truncate">{row.new_manufacturer ?? "—"}</td>
                          <td className="p-2 tabular-nums">{row.old_qty ?? "—"}</td>
                          <td className="p-2 tabular-nums">{row.new_qty ?? "—"}</td>
                          <td className="p-2">
                            {row.old_dnp != null || row.new_dnp != null
                              ? `${row.old_dnp ? "כן" : "לא"} → ${row.new_dnp ? "כן" : "לא"}`
                              : "—"}
                          </td>
                          <td className="p-2 max-w-[140px] truncate" title={desc ?? undefined}>
                            {desc ?? "—"}
                          </td>
                          <td className="p-2 max-w-[100px] truncate text-slate-500" title={row.notes ?? undefined}>
                            {row.notes ?? "—"}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {lineId && projectId && targetId ? (
                              <Link
                                href={`/bom?project_id=${projectId}&version_id=${targetId}&line_id=${lineId}`}
                                className="text-brand hover:underline text-[10px]"
                              >
                                פתח שורה
                              </Link>
                            ) : (
                              <span className="text-slate-300 text-[10px]">—</span>
                            )}
                            <span className="text-slate-300 mx-1">|</span>
                            <span className="text-slate-400 text-[10px]" title="בקרוב">
                              סמן כנבדק
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : loading ? (
        <div className="py-12 text-center text-slate-500 text-[13px]">
          <Loader2 className="w-5 h-5 animate-spin inline-block ml-2" />
          משווה גרסאות…
        </div>
      ) : null}
    </div>
  );
}
