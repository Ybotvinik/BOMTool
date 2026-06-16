"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Card, PageHeader, Badge } from "@/components/ui";
import { apiDownloadPost, apiGet, triggerBlobDownload } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = { id: number; name: string; code: string };
type ApiVersion = {
  id: number;
  version_label: string;
  version_name: string | null;
  is_active: boolean;
};
type ApiSnapshot = {
  id: number;
  name: string;
  snapshot_name: string | null;
};

const CUSTOMER_CHECKLIST = [
  "ללא נתוני China Quote",
  "ללא עלות פנימית",
  "ללא מרווח ספק",
  "ללא הערות פנימיות",
  "ללא Match Confidence",
];

function ExportInner() {
  const urlParams = useSearchParams();
  const urlProjectId = urlParams.get("project_id");
  const urlBomVersionId = urlParams.get("bom_version_id");
  const urlPricingSnapshotId = urlParams.get("pricing_snapshot_id");
  const { user } = useCurrentUser();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [snapshots, setSnapshots] = useState<ApiSnapshot[]>([]);
  const [projectId, setProjectId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects")
      .then(setProjects)
      .catch(() => setError("לא ניתן לטעון פרויקטים"));
  }, []);

  useEffect(() => {
    const urlPid = urlProjectId;
    if (urlPid && projects.some((p) => String(p.id) === urlPid)) {
      setProjectId(urlPid);
    }
  }, [urlProjectId, projects]);

  useEffect(() => {
    if (!projectId) {
      setVersions([]);
      setSnapshots([]);
      setVersionId("");
      setSnapshotId("");
      return;
    }
    const pid = Number(projectId);
    Promise.all([
      apiGet<ApiVersion[]>(`/api/bom-versions?project_id=${pid}`),
      apiGet<ApiSnapshot[]>(`/api/projects/${pid}/pricing-snapshots`),
    ])
      .then(([vs, snaps]) => {
        setVersions(vs);
        setSnapshots(snaps);
        const urlVid = urlBomVersionId;
        const urlSid = urlPricingSnapshotId;
        const active = vs.find((v) => v.is_active) ?? vs[vs.length - 1];
        setVersionId(
          urlVid && vs.some((v) => String(v.id) === urlVid)
            ? urlVid
            : active
              ? String(active.id)
              : "",
        );
        setSnapshotId(
          urlSid && snaps.some((s) => String(s.id) === urlSid)
            ? urlSid
            : snaps[0]
              ? String(snaps[0].id)
              : "",
        );
      })
      .catch(() => setError("לא ניתן לטעון גרסאות / נציגי מחיר"));
  }, [projectId, urlBomVersionId, urlPricingSnapshotId]);

  async function runExport(
    key: string,
    path: string,
    body: Record<string, number>,
  ) {
    setBusy(key);
    setError(null);
    try {
      const { blob, fileName } = await apiDownloadPost(path, body, user.id);
      triggerBlobDownload(blob, fileName);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  const pid = projectId ? Number(projectId) : null;
  const vid = versionId ? Number(versionId) : null;
  const sid = snapshotId ? Number(snapshotId) : null;
  const canBomExport = pid != null && vid != null;
  const canPricingExport = pid != null && sid != null;

  return (
    <>
      <PageHeader
        title="דוחות וייצוא"
        subtitle="הפקת קבצי Excel — ייצוא ללקוח וייצוא פנימי"
      />

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
          {error}
        </div>
      )}

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">פרויקט</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
            >
              <option value="">בחר פרויקט</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">גרסת BOM</label>
            <select
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
              disabled={!projectId}
              className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white disabled:opacity-60"
            >
              <option value="">בחר גרסה</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_name || v.version_label}
                  {v.is_active ? " ★" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">Pricing Snapshot</label>
            <select
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              disabled={!projectId}
              className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white disabled:opacity-60"
            >
              <option value="">בחר Snapshot</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.snapshot_name || s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-risk-low" />
            <h2 className="text-[14px] font-semibold">ייצוא ללקוח</h2>
            <Badge className="bg-green-50 text-risk-low border-green-200">Customer Safe</Badge>
          </div>
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <FileSpreadsheet className="h-8 w-8 text-brand shrink-0" />
              <div>
                <div className="text-[13.5px] font-semibold">Customer BOM Cost Review Excel</div>
                <div className="text-[11.5px] text-slate-500 mt-0.5">
                  דוח עלות BOM ללקוח — כולל Price Source, מחירי לקוח וסיכום עלויות (USD)
                </div>
              </div>
            </div>
            <ul className="mb-4 space-y-1">
              {CUSTOMER_CHECKLIST.map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5 text-risk-low shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              disabled={!canBomExport || busy != null}
              onClick={() =>
                runExport("customer", "/api/exports/customer-bom-review", {
                  project_id: pid!,
                  bom_version_id: vid!,
                })
              }
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60"
            >
              {busy === "customer" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              הורד Excel
            </button>
          </Card>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-amber-700" />
            <h2 className="text-[14px] font-semibold">ייצוא פנימי</h2>
            <Badge className="bg-amber-50 text-amber-800 border-amber-200">Internal Only</Badge>
          </div>
          <div className="space-y-3">
            <Card className="p-4">
              <div className="flex items-start gap-3 mb-2">
                <FileSpreadsheet className="h-7 w-7 text-brand shrink-0" />
                <div>
                  <div className="text-[13px] font-semibold">Internal BOM Quality Excel</div>
                  <div className="text-[11px] text-slate-500">סטטוס איכות, DNP, Needs Review</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-800 mb-3">
                <AlertTriangle className="h-3.5 w-3.5" />
                פנימי בלבד — לא להעברה ללקוח
              </div>
              <button
                disabled={!canBomExport || busy != null}
                onClick={() =>
                  runExport("quality", "/api/exports/internal-bom-quality", {
                    project_id: pid!,
                    bom_version_id: vid!,
                  })
                }
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50 disabled:opacity-60"
              >
                {busy === "quality" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                הורד Excel
              </button>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3 mb-2">
                <FileSpreadsheet className="h-7 w-7 text-brand shrink-0" />
                <div>
                  <div className="text-[13px] font-semibold">Internal Pricing Snapshot Excel</div>
                  <div className="text-[11px] text-slate-500">עלות יחידה, Extended Cost, Match Confidence</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-800 mb-3">
                <AlertTriangle className="h-3.5 w-3.5" />
                פנימי בלבד — לא להעברה ללקוח
              </div>
              <button
                disabled={!canPricingExport || busy != null}
                onClick={() =>
                  runExport("pricing", "/api/exports/internal-pricing-snapshot", {
                    project_id: pid!,
                    pricing_snapshot_id: sid!,
                  })
                }
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50 disabled:opacity-60"
              >
                {busy === "pricing" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                הורד Excel
              </button>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}

export default function ExportPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <ExportInner />
    </Suspense>
  );
}
