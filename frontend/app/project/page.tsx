"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ClipboardList,
  DollarSign,
  Download,
  GitBranch,
  Package,
  ShieldCheck,
  Table2,
  Upload,
  Wallet,
} from "lucide-react";
import { Card, PageHeader, Kpi, StatusBadge, Badge } from "@/components/ui";
import { apiDownloadPost, apiGet, triggerBlobDownload } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = {
  id: number;
  customer_id: number;
  name: string;
  code: string;
  status: string;
  build_quantity: number;
  active_version_id: number | null;
};
type ApiCustomer = { id: number; name: string };
type Metrics = {
  customer_name: string | null;
  bom_total_lines: number;
  bom_quality_score: number | null;
  bom_needs_review_count: number;
  bom_error_count: number;
  bom_warning_count: number;
  latest_internal_cost: number | null;
  latest_internal_cost_currency: string | null;
  active_bom_version_name: string | null;
  active_bom_version_id: number | null;
  latest_china_quote_id: number | null;
  latest_china_quote_name: string | null;
  latest_china_quote_matched_count: number;
  latest_china_quote_possible_count: number;
  latest_china_quote_not_matched_count: number;
  latest_pricing_snapshot_id: number | null;
  latest_pricing_snapshot_name: string | null;
  missing_price_count: number;
  updated_at: string | null;
  build_quantity: number;
  bom_revision_code: string | null;
  bom_doc_number: string | null;
  bom_board_name: string | null;
};
type QualityIssue = {
  line_number: number | null;
  original_mpn: string | null;
  quality_status: string;
  review_reason: string | null;
};
type ActivityRow = {
  id: number;
  action_type: string;
  entity_name: string | null;
  change_summary: string | null;
  created_at: string;
};

function bomTableHref(projectId: number, versionId: number | null) {
  const base = `/bom?project_id=${projectId}`;
  return versionId != null ? `${base}&version_id=${versionId}` : base;
}

function exportHref(projectId: number, versionId: number | null, snapshotId: number | null) {
  let href = `/export?project_id=${projectId}`;
  if (versionId != null) href += `&bom_version_id=${versionId}`;
  if (snapshotId != null) href += `&pricing_snapshot_id=${snapshotId}`;
  return href;
}

function ProjectOverviewInner() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const urlProjectId = useSearchParams().get("project_id");
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportBusy, setExportBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setProject(null);
      setMetrics(null);
      setIssues([]);
      setActivity([]);
      try {
        if (!urlProjectId) {
          const ps = await apiGet<ApiProject[]>("/api/projects");
          if (!cancelled) setProjects(ps);
          return;
        }
        const id = Number(urlProjectId);
        if (!Number.isFinite(id)) {
          if (!cancelled) setError("הפרויקט שנבחר לא נמצא");
          return;
        }
        const [p, m, act] = await Promise.all([
          apiGet<ApiProject>(`/api/projects/${id}`),
          apiGet<Metrics>(`/api/projects/${id}/metrics`),
          apiGet<ActivityRow[]>(`/api/projects/${id}/activity?limit=8`),
        ]);
        if (cancelled) return;
        setProject(p);
        setMetrics(m);
        setActivity(act);
        const vid = p.active_version_id ?? m.active_bom_version_id;
        if (vid != null) {
          const iss = await apiGet<QualityIssue[]>(
            `/api/bom-versions/${vid}/quality-issues`,
          );
          if (!cancelled) setIssues(iss.slice(0, 5));
        }
      } catch {
        if (!cancelled) setError("הפרויקט שנבחר לא נמצא");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlProjectId]);

  async function quickExport(
    key: string,
    path: string,
    body: Record<string, number>,
  ) {
    setExportBusy(key);
    try {
      const { blob, fileName } = await apiDownloadPost(path, body, user.id);
      triggerBlobDownload(blob, fileName);
    } catch (e) {
      setError(String(e));
    } finally {
      setExportBusy(null);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>;
  }

  if (!urlProjectId) {
    return (
      <>
        <PageHeader title="סקירת פרויקט" subtitle="בחר פרויקט" />
        <Card className="p-6 max-w-md">
          <label className="block text-[12px] text-slate-600 mb-1">פרויקט</label>
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) router.push(`/project?project_id=${v}`);
            }}
            className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
          >
            <option value="">בחר פרויקט</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </Card>
      </>
    );
  }

  if (error || !project || !metrics) {
    return (
      <>
        <PageHeader title="סקירת פרויקט" subtitle="" />
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
          {error ?? "הפרויקט שנבחר לא נמצא"}
        </div>
      </>
    );
  }

  const pid = project.id;
  const versionId = project.active_version_id ?? metrics.active_bom_version_id;
  const bomHref = bomTableHref(pid, versionId);
  const qualityHref =
    versionId != null
      ? `/quality?project_id=${pid}&version_id=${versionId}`
      : `/quality?project_id=${pid}`;
  const chinaHref = `/china-quote?project_id=${pid}`;
  const pricingHref = metrics.latest_pricing_snapshot_id
    ? `/pricing-snapshots/${metrics.latest_pricing_snapshot_id}`
    : null;
  const exportLink = exportHref(pid, versionId, metrics.latest_pricing_snapshot_id);
  const money =
    metrics.latest_internal_cost == null
      ? "—"
      : `${Math.round(metrics.latest_internal_cost).toLocaleString()} ${metrics.latest_internal_cost_currency ?? ""}`.trim();
  const updatedAt = metrics.updated_at
    ? metrics.updated_at.replace("T", " ").slice(0, 16)
    : "—";

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`${metrics.customer_name ?? "—"} · ${project.code}`}
        actions={<StatusBadge status={project.status} />}
      />

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
          {error}
        </div>
      )}

      <Card className="p-3 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1.5 text-[11.5px]">
          {[
            ["לקוח", metrics.customer_name ?? "—"],
            ["שם פרויקט", project.name],
            ["קוד פרויקט", project.code],
            ["סטטוס", project.status],
            ["Build Quantity", metrics.build_quantity.toLocaleString()],
            ["Active BOM", metrics.active_bom_version_name ?? "—"],
            ["Revision", metrics.bom_revision_code ?? "—"],
            ["Doc Number", metrics.bom_doc_number ?? "—"],
            ["Board Name", metrics.bom_board_name ?? "—"],
            ["עודכן", updatedAt],
          ].map(([k, v]) => (
            <div key={k}>
              <span className="text-slate-500">{k}: </span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-4">
        <Kpi label="BOM Lines" value={metrics.bom_total_lines} tone="default" />
        <Kpi
          label="Quality Score"
          value={metrics.bom_quality_score ?? "—"}
          tone={
            (metrics.bom_quality_score ?? 100) >= 90
              ? "good"
              : (metrics.bom_quality_score ?? 0) >= 70
                ? "warn"
                : "bad"
          }
        />
        <Kpi label="Needs Review" value={metrics.bom_needs_review_count} tone="warn" />
        <Kpi label="Errors" value={metrics.bom_error_count} tone="bad" />
        <Kpi label="Warnings" value={metrics.bom_warning_count} tone="warn" />
        <Kpi
          label="China Quote"
          value={metrics.latest_china_quote_name ?? "—"}
          tone="default"
        />
        <Kpi label="Matched" value={metrics.latest_china_quote_matched_count} tone="good" />
        <Kpi label="Possible" value={metrics.latest_china_quote_possible_count} tone="warn" />
        <Kpi label="Not Matched" value={metrics.latest_china_quote_not_matched_count} tone="bad" />
        <Kpi label="Internal Cost" value={money} tone="default" />
        <Kpi label="Missing Prices" value={metrics.missing_price_count} tone="warn" />
      </div>

      <Card className="p-3 mb-4">
        <div className="text-[12px] font-semibold text-navy mb-2">קיצורי דרך</div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={bomHref}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50"
          >
            <Table2 className="h-3.5 w-3.5" /> טבלת BOM
          </Link>
          <Link
            href={qualityHref}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> איכות BOM
          </Link>
          <Link
            href={chinaHref}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50"
          >
            <DollarSign className="h-3.5 w-3.5" /> מחירון סין
          </Link>
          {pricingHref ? (
            <Link
              href={pricingHref}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50"
            >
              <Wallet className="h-3.5 w-3.5" /> Pricing Snapshot
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-slate-50 text-[12px] text-slate-400 opacity-60">
              <Wallet className="h-3.5 w-3.5" /> Pricing Snapshot
            </span>
          )}
          <Link
            href={`/upload-bom?project_id=${pid}`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-3.5 w-3.5" /> טעינת BOM
          </Link>
          <Link
            href={exportLink}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> דוחות וייצוא
          </Link>
          {versionId != null && (
            <>
              <button
                type="button"
                disabled={exportBusy != null}
                onClick={() =>
                  quickExport("customer", "/api/exports/customer-bom-review", {
                    project_id: pid,
                    bom_version_id: versionId,
                  })
                }
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" /> Customer BOM Review
              </button>
              <button
                type="button"
                disabled={exportBusy != null}
                onClick={() =>
                  quickExport("quality", "/api/exports/internal-bom-quality", {
                    project_id: pid,
                    bom_version_id: versionId,
                  })
                }
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" /> Internal Quality
              </button>
            </>
          )}
          {metrics.latest_pricing_snapshot_id != null && (
            <button
              type="button"
              disabled={exportBusy != null}
              onClick={() =>
                quickExport("pricing", "/api/exports/internal-pricing-snapshot", {
                  project_id: pid,
                  pricing_snapshot_id: metrics.latest_pricing_snapshot_id!,
                })
              }
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" /> Internal Pricing
            </button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-brand" />
            <h2 className="text-[14px] font-semibold">סטטוס BOM</h2>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-[12px]">
            <div>
              <dt className="text-slate-500">גרסה פעילה</dt>
              <dd className="font-semibold">{metrics.active_bom_version_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">שורות</dt>
              <dd className="font-semibold tabular-nums">{metrics.bom_total_lines}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Quality Score</dt>
              <dd className="font-semibold tabular-nums">{metrics.bom_quality_score ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Needs Review</dt>
              <dd className="font-semibold tabular-nums">{metrics.bom_needs_review_count}</dd>
            </div>
          </dl>
          <Link href={bomHref} className="mt-3 inline-flex text-[12px] text-brand hover:underline">
            פתח טבלת BOM →
          </Link>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-risk-medium" />
            <h2 className="text-[14px] font-semibold">Top Quality Issues</h2>
          </div>
          {issues.length === 0 ? (
            <p className="text-[12px] text-slate-400">אין בעיות איכות פתוחות</p>
          ) : (
            <ul className="space-y-2">
              {issues.map((iss, i) => (
                <li key={i} className="text-[11.5px] border-b border-slate-100 pb-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{iss.original_mpn ?? "—"}</span>
                    <Badge
                      className={
                        iss.quality_status === "error"
                          ? "bg-red-50 text-risk-critical border-red-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }
                    >
                      {iss.quality_status}
                    </Badge>
                  </div>
                  <div className="text-slate-500 truncate">{iss.review_reason ?? "—"}</div>
                </li>
              ))}
            </ul>
          )}
          <Link href={qualityHref} className="mt-3 inline-flex text-[12px] text-brand hover:underline">
            כל בעיות האיכות →
          </Link>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-brand" />
            <h2 className="text-[14px] font-semibold">China Quote Summary</h2>
          </div>
          {metrics.latest_china_quote_id == null ? (
            <p className="text-[12px] text-slate-400">אין הצעת מחיר סין</p>
          ) : (
            <dl className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="col-span-2">
                <dt className="text-slate-500">Quote</dt>
                <dd className="font-semibold">{metrics.latest_china_quote_name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Matched</dt>
                <dd className="font-semibold tabular-nums text-risk-low">
                  {metrics.latest_china_quote_matched_count}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Possible</dt>
                <dd className="font-semibold tabular-nums">{metrics.latest_china_quote_possible_count}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Not Matched</dt>
                <dd className="font-semibold tabular-nums text-risk-critical">
                  {metrics.latest_china_quote_not_matched_count}
                </dd>
              </div>
            </dl>
          )}
          <Link href={chinaHref} className="mt-3 inline-flex text-[12px] text-brand hover:underline">
            מחירון סין →
          </Link>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-4 w-4 text-brand" />
            <h2 className="text-[14px] font-semibold">Internal Cost Summary</h2>
          </div>
          {metrics.latest_pricing_snapshot_id == null ? (
            <p className="text-[12px] text-slate-400">אין Pricing Snapshot</p>
          ) : (
            <dl className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="col-span-2">
                <dt className="text-slate-500">Snapshot</dt>
                <dd className="font-semibold">{metrics.latest_pricing_snapshot_name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Internal Cost</dt>
                <dd className="font-semibold">{money}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Missing Prices</dt>
                <dd className="font-semibold tabular-nums">{metrics.missing_price_count}</dd>
              </div>
            </dl>
          )}
          {pricingHref && (
            <Link href={pricingHref} className="mt-3 inline-flex text-[12px] text-brand hover:underline">
              Pricing Snapshot →
            </Link>
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-brand" />
            <h2 className="text-[14px] font-semibold">Recent Activity</h2>
          </div>
          {activity.length === 0 ? (
            <p className="text-[12px] text-slate-400">אין פעילות אחרונה</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="text-right py-1.5 font-medium">זמן</th>
                    <th className="text-right py-1.5 font-medium">פעולה</th>
                    <th className="text-right py-1.5 font-medium">פרטים</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="py-1.5 whitespace-nowrap text-slate-500">
                        {a.created_at.replace("T", " ").slice(0, 16)}
                      </td>
                      <td className="py-1.5">{a.action_type}</td>
                      <td className="py-1.5 text-slate-600 truncate max-w-xs">
                        {a.change_summary ?? a.entity_name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/activity" className="mt-3 inline-flex text-[12px] text-brand hover:underline">
            יומן פעולות מלא →
          </Link>
        </Card>
      </div>
    </>
  );
}

export default function ProjectOverviewPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <ProjectOverviewInner />
    </Suspense>
  );
}
