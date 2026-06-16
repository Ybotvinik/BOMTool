"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Loader2, Pencil, ExternalLink, ShieldCheck } from "lucide-react";
import { Card, PageHeader, Kpi, Badge } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import { EditBomLineModal, type QualityLine } from "@/components/EditBomLineModal";

type ApiProject = { id: number; name: string; code: string; active_version_id: number | null };
type ApiVersion = { id: number; version_label: string; version_name: string | null; is_active: boolean };
type Summary = Record<string, number>;

function SeverityBadge({ status }: { status: string }) {
  if (status === "error") return <Badge className="bg-red-50 text-risk-critical border-red-200">Error</Badge>;
  if (status === "warning") return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Warning</Badge>;
  return <Badge className="bg-green-50 text-risk-low border-green-200">OK</Badge>;
}

export default function QualityPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <QualityPageInner />
    </Suspense>
  );
}

function QualityPageInner() {
  const urlProjectId = useSearchParams().get("project_id");
  const urlVersionId = useSearchParams().get("version_id");
  const { user } = useCurrentUser();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [issues, setIssues] = useState<QualityLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<QualityLine | null>(null);

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects").then((ps) => {
      setProjects(ps);
      if (urlProjectId) {
        const match = ps.find((p) => String(p.id) === urlProjectId);
        if (match) setProjectId(match.id);
      } else if (ps.length) {
        setProjectId(ps[0].id);
      }
    });
  }, [urlProjectId]);

  useEffect(() => {
    if (projectId == null) return;
    apiGet<ApiVersion[]>(`/api/bom-versions?project_id=${projectId}`).then((vs) => {
      setVersions(vs);
      if (urlVersionId) {
        const match = vs.find((v) => String(v.id) === urlVersionId);
        if (match) {
          setVersionId(match.id);
          return;
        }
      }
      const active = vs.find((v) => v.is_active) ?? vs[vs.length - 1];
      setVersionId(active ? active.id : null);
    });
  }, [projectId, urlVersionId]);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const [sum, iss] = await Promise.all([
        apiGet<Summary>(`/api/bom-versions/${id}/quality-summary`),
        apiGet<QualityLine[]>(`/api/bom-versions/${id}/quality-issues`),
      ]);
      setSummary(sum);
      setIssues(iss);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (versionId != null) load(versionId);
  }, [versionId, load]);

  async function reanalyze() {
    if (versionId == null) return;
    setBusy(true);
    try {
      await apiPost(`/api/bom-versions/${versionId}/reanalyze-quality`, {}, user.id);
      await load(versionId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="איכות BOM"
        subtitle="ניתוח איכות שורות BOM, זיהוי בעיות ותיקון ידני"
        actions={
          <>
            <select
              value={projectId ?? ""}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={versionId ?? ""}
              onChange={(e) => setVersionId(Number(e.target.value))}
              className="h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white"
            >
              {versions.length === 0 && <option value="">אין גרסאות</option>}
              {versions.map((v) => (
                <option key={v.id} value={v.id}>{v.version_name ?? v.version_label} (#{v.id}){v.is_active ? " ★" : ""}</option>
              ))}
            </select>
            <button
              onClick={reanalyze}
              disabled={busy || versionId == null}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              נתח מחדש איכות BOM
            </button>
          </>
        }
      />

      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3 mb-4">
        <Kpi label="Quality Score" value={summary?.quality_score ?? "—"} tone={(summary?.quality_score ?? 100) >= 90 ? "good" : (summary?.quality_score ?? 0) >= 70 ? "warn" : "bad"} />
        <Kpi label="Total" value={summary?.total_lines ?? 0} />
        <Kpi label="OK" value={summary?.ok_count ?? 0} tone="good" />
        <Kpi label="Warnings" value={summary?.warning_count ?? 0} tone="warn" />
        <Kpi label="Errors" value={summary?.error_count ?? 0} tone="bad" />
        <Kpi label="Needs Review" value={summary?.needs_review_count ?? 0} tone="warn" />
        <Kpi label="DNP" value={summary?.dnp_count ?? 0} />
        <Kpi label="Missing MPN" value={summary?.missing_mpn_count ?? 0} tone="bad" />
        <Kpi label="Missing Qty" value={summary?.missing_qty_count ?? 0} tone="bad" />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
            <Loader2 className="h-4 w-4 animate-spin" /> טוען...
          </div>
        ) : issues.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-risk-low text-[13px]">
            <ShieldCheck className="h-7 w-7" /> אין בעיות איכות בגרסה זו.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-right">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Severity</th>
                  <th className="px-2 py-2 font-medium">Issue / Review Reason</th>
                  <th className="px-2 py-2 font-medium">MPN</th>
                  <th className="px-2 py-2 font-medium">Manufacturer</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium text-center">Qty</th>
                  <th className="px-2 py-2 font-medium">RefDes</th>
                  <th className="px-2 py-2 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((r) => (
                  <tr key={r.line_id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-2 py-1.5 text-slate-400 tabular-nums">{r.line_number}</td>
                    <td className="px-2 py-1.5"><SeverityBadge status={r.quality_status} /></td>
                    <td className="px-2 py-1.5 text-amber-700">{r.review_reason || "—"}</td>
                    <td className="px-2 py-1.5 font-medium tabular-nums">{r.original_mpn || "—"}</td>
                    <td className="px-2 py-1.5">{r.manufacturer || "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-[220px] truncate">{r.original_description || "—"}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{r.qty_per_assembly ?? "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-[140px] truncate">{r.reference_designators || "—"}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditing(r)} title="עריכה" className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-brand">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <Link href={`/bom?version_id=${versionId}`} title="פתח בטבלת BOM" className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-brand">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <EditBomLineModal
          line={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            if (versionId) load(versionId);
          }}
        />
      )}
    </>
  );
}
