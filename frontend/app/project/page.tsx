"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, GitBranch, Package, Upload, Wallet } from "lucide-react";
import { Card, PageHeader, Kpi, StatusBadge, Badge } from "@/components/ui";
import { apiGet } from "@/lib/api";

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
  bom_total_lines: number;
  bom_quality_score: number | null;
  bom_needs_review_count: number;
  latest_internal_cost: number | null;
  latest_internal_cost_currency: string | null;
  active_bom_version_name: string | null;
  active_bom_version_id: number | null;
};

function bomTableHref(projectId: number, activeVersionId: number | null) {
  const base = `/bom?project_id=${projectId}`;
  return activeVersionId != null ? `${base}&version_id=${activeVersionId}` : base;
}

function ProjectOverviewInner() {
  const router = useRouter();
  const urlProjectId = useSearchParams().get("project_id");
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setProject(null);
      setMetrics(null);
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
        try {
          const [p, m, cs] = await Promise.all([
            apiGet<ApiProject>(`/api/projects/${id}`),
            apiGet<Metrics>(`/api/projects/${id}/metrics`),
            apiGet<ApiCustomer[]>("/api/customers"),
          ]);
          if (!cancelled) {
            setProject(p);
            setMetrics(m);
            setCustomers(cs);
          }
        } catch {
          if (!cancelled) setError("הפרויקט שנבחר לא נמצא");
        }
      } catch {
        if (!cancelled) setError("לא ניתן לטעון פרויקטים — ודא שה-API פעיל.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlProjectId]);

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

  if (error || !project) {
    return (
      <>
        <PageHeader title="סקירת פרויקט" subtitle="" />
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
          {error ?? "הפרויקט שנבחר לא נמצא"}
        </div>
      </>
    );
  }

  const customerName = customers.find((c) => c.id === project.customer_id)?.name ?? "—";
  const pid = project.id;
  const activeVersionId = project.active_version_id ?? metrics?.active_bom_version_id ?? null;
  const bomHref = bomTableHref(pid, activeVersionId);
  const money =
    metrics?.latest_internal_cost == null
      ? "—"
      : `${Math.round(metrics.latest_internal_cost).toLocaleString()} ${metrics.latest_internal_cost_currency ?? ""}`.trim();

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`${customerName} · ${project.code} · Build Qty ${project.build_quantity.toLocaleString()}`}
        actions={
          <>
            <StatusBadge status={project.status} />
            <Link
              href={`/upload-bom?project_id=${pid}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50"
            >
              <Upload className="h-3.5 w-3.5" /> טעינת BOM
            </Link>
            <Link
              href={bomHref}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90"
            >
              <GitBranch className="h-3.5 w-3.5" /> טבלת BOM
            </Link>
          </>
        }
      />

      <Card className="p-3 mb-5">
        <div className="text-[12.5px] font-semibold text-navy mb-2">פרטי פרויקט</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[11.5px]">
          <div>
            <span className="text-slate-500">לקוח: </span>
            <span className="font-medium">{customerName}</span>
          </div>
          <div>
            <span className="text-slate-500">שם פרויקט: </span>
            <span className="font-medium">{project.name}</span>
          </div>
          <div>
            <span className="text-slate-500">קוד פרויקט: </span>
            <span className="font-medium">{project.code}</span>
          </div>
          {process.env.NODE_ENV === "development" && (
            <div>
              <span className="text-slate-500">Project ID: </span>
              <span className="font-medium tabular-nums">{pid}</span>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Internal Cost" value={money} tone="default" />
        <Kpi
          label="BOM Quality Score"
          value={metrics?.bom_quality_score ?? "—"}
          tone={
            (metrics?.bom_quality_score ?? 100) >= 90
              ? "good"
              : (metrics?.bom_quality_score ?? 0) >= 70
                ? "warn"
                : "bad"
          }
        />
        <Kpi label="Needs Review" value={metrics?.bom_needs_review_count ?? "—"} tone="warn" />
        <Kpi label="BOM Lines" value={metrics?.bom_total_lines ?? "—"} tone="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-brand" />
            <h2 className="text-[14px] font-semibold">סיכום BOM</h2>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12.5px]">
            {[
              ["Active BOM", metrics?.active_bom_version_name ?? "—", true],
              ["שורות BOM", metrics?.bom_total_lines?.toString() ?? "—", false],
              ["Needs Review", metrics?.bom_needs_review_count?.toString() ?? "—", false],
            ].map(([k, v, linkBom]) => (
              <div key={k} className="rounded-md border border-slate-200 p-2.5">
                <div className="text-slate-500">{k}</div>
                {linkBom && v !== "—" ? (
                  <Link href={bomHref} className="text-[16px] font-bold tabular-nums mt-0.5 text-brand hover:underline block">
                    {v}
                  </Link>
                ) : (
                  <div className="text-[16px] font-bold tabular-nums mt-0.5">{v}</div>
                )}
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-risk-medium" />
            <h2 className="text-[14px] font-semibold">סיכון ואיכות</h2>
          </div>
          <ul className="space-y-2 text-[12.5px]">
            <li className="flex items-center justify-between">
              <span>Needs Review</span>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                {metrics?.bom_needs_review_count ?? 0}
              </Badge>
            </li>
            <li className="flex items-center justify-between">
              <span>BOM Quality Score</span>
              {metrics?.bom_quality_score != null ? (
                <Badge className="bg-green-50 text-risk-low border-green-200">
                  {metrics.bom_quality_score}%
                </Badge>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </li>
          </ul>
          <Link
            href={bomHref}
            className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90"
          >
            <GitBranch className="h-3.5 w-3.5" /> פתח טבלת BOM
          </Link>
        </Card>
      </div>

      <Card className="p-4 mt-3">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-4 w-4 text-brand" />
          <h2 className="text-[14px] font-semibold">Pricing Snapshot אחרון</h2>
        </div>
        <p className="text-[12px] text-slate-500">Internal Cost {money}</p>
      </Card>
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
