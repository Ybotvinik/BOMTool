"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  AlertTriangle,
  ClipboardList,
  DollarSign,
  Download,
  FileText,
  Package,
  Pencil,
  ShieldCheck,
  ShoppingCart,
  Table2,
  Upload,
  Layers,
  CheckCircle2,
  XCircle,
  Camera,
  TrendingUp,
  Box,
  ChevronLeft,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/ui";
import {
  EditProjectParamsModal,
  type ProjectParamsForm,
} from "@/components/project/EditProjectParamsModal";
import { apiDownloadPost, apiGet, triggerBlobDownload } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import { qualityScoreTone } from "@/components/bom/types";

type ApiProject = {
  id: number;
  customer_id: number;
  name: string;
  code: string;
  status: string;
  build_quantity: number;
  description: string | null;
  active_version_id: number | null;
};

type Metrics = {
  customer_name: string | null;
  bom_total_lines: number;
  bom_non_dnp_lines: number;
  bom_dnp_count: number;
  bom_ok_count: number;
  bom_quality_score: number | null;
  bom_needs_review_count: number;
  bom_error_count: number;
  bom_warning_count: number;
  official_selected_total: number | null;
  official_has_solution: number;
  official_needs_approval: number;
  official_no_solution: number;
  official_dnp: number;
  official_priced_lines?: number;
  official_no_stock_count?: number;
  official_missing_prices?: number;
  official_snapshot_id: number | null;
  official_snapshot_name: string | null;
  official_snapshot_total: number | null;
  official_snapshot_created_at: string | null;
  latest_customer_export_at: string | null;
  latest_procurement_export_at: string | null;
  project_files_count: number;
  active_bom_version_name: string | null;
  active_bom_version_id: number | null;
  active_bom_is_active: boolean | null;
  effective_build_quantity: number;
  bom_revision_code: string | null;
  bom_doc_number: string | null;
  bom_board_name: string | null;
  bom_version_notes: string | null;
  updated_at: string | null;
  build_quantity: number;
  description: string | null;
};

function fmt(v: string | number | null | undefined, fallback = "לא זמין") {
  if (v == null || v === "") return fallback;
  return String(v);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "לא זמין";
  return iso.replace("T", " ").slice(0, 16);
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function DashKpi({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad" | "muted";
  icon?: React.ReactNode;
}) {
  const tones = {
    default: "border-slate-200 bg-white",
    good: "border-green-200/80 bg-gradient-to-br from-green-50/80 to-white",
    warn: "border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white",
    bad: "border-red-200/80 bg-gradient-to-br from-red-50/80 to-white",
    muted: "border-slate-200 bg-slate-50/60",
  };
  const valTone = {
    default: "text-slate-800",
    good: "text-green-700",
    warn: "text-amber-700",
    bad: "text-red-700",
    muted: "text-slate-600",
  }[tone];
  return (
    <Card className={clsx("p-3.5 transition-shadow hover:shadow-md", tones[tone])}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10.5px] text-slate-500 leading-tight font-medium">{label}</div>
        {icon && <span className="text-slate-400 shrink-0 opacity-80">{icon}</span>}
      </div>
      <div className={clsx("text-[22px] font-bold tabular-nums mt-1.5 tracking-tight", valTone)}>
        {value}
      </div>
      {hint && <p className="text-[9.5px] text-slate-400 mt-1 leading-snug">{hint}</p>}
    </Card>
  );
}

function SectionCard({
  title,
  icon,
  children,
  cta,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  cta?: { href: string; label: string };
}) {
  return (
    <Card className="p-4 h-full flex flex-col border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
          {icon}
        </span>
        <h2 className="text-[14px] font-bold text-navy">{title}</h2>
      </div>
      <div className="flex-1 text-[12px]">{children}</div>
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-flex items-center gap-1 text-[12px] text-brand font-semibold hover:underline"
        >
          {cta.label}
          <ChevronLeft className="h-3.5 w-3.5" />
        </Link>
      )}
    </Card>
  );
}

function QualityGauge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const tone = qualityScoreTone(s);
  const bar =
    tone === "good" ? "bg-green-500" : tone === "warn" ? "bg-amber-500" : "bg-red-500";
  const text =
    tone === "good" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-red-700";
  return (
    <div className="rounded-lg bg-slate-50/80 p-3 border border-slate-100">
      <div className="flex items-end justify-between mb-2">
        <span className={clsx("text-[32px] font-bold tabular-nums leading-none", text)}>
          {score ?? "—"}
        </span>
        <span className="text-[10px] text-slate-500 pb-1">ציון איכות / 100</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-200/80 overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all", bar)} style={{ width: `${Math.min(100, s)}%` }} />
      </div>
    </div>
  );
}

function ProjectOverviewInner() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const urlProjectId = useSearchParams().get("project_id");
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const [p, m] = await Promise.all([
        apiGet<ApiProject>(`/api/projects/${id}`),
        apiGet<Metrics>(`/api/projects/${id}/metrics`),
      ]);
      setProject(p);
      setMetrics(m);
    } catch {
      setError("הפרויקט שנבחר לא נמצא");
      setProject(null);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!urlProjectId) {
      apiGet<ApiProject[]>("/api/projects").then(setProjects).finally(() => setLoading(false));
      return;
    }
    const id = Number(urlProjectId);
    if (!Number.isFinite(id)) {
      setError("הפרויקט שנבחר לא נמצא");
      setLoading(false);
      return;
    }
    load(id);
  }, [urlProjectId, load]);

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
    return (
      <div className="py-16 text-center text-slate-500 text-[13px]">
        <div className="inline-block h-6 w-6 border-2 border-brand border-t-transparent rounded-full animate-spin mb-2" />
        <p>טוען סקירת פרויקט…</p>
      </div>
    );
  }

  if (!urlProjectId) {
    return (
      <>
        <div className="mb-4">
          <h1 className="text-[20px] font-bold text-navy">סקירת פרויקט</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">מרכז שליטה — בחר פרויקט להצגת Dashboard</p>
        </div>
        <Card className="p-6 max-w-md shadow-sm">
          <label className="block text-[12px] text-slate-600 mb-1.5 font-medium">פרויקט</label>
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) router.push(`/project?project_id=${v}`);
            }}
            className="w-full h-10 rounded-md border border-slate-200 px-3 text-[13px] bg-white"
          >
            <option value="">בחר פרויקט…</option>
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
      <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
        {error ?? "הפרויקט שנבחר לא נמצא"}
      </div>
    );
  }

  const pid = project.id;
  const versionId = project.active_version_id ?? metrics.active_bom_version_id;
  const bomHref =
    versionId != null ? `/bom?project_id=${pid}&version_id=${versionId}` : `/bom?project_id=${pid}`;
  const qualityHref =
    versionId != null
      ? `/bom?project_id=${pid}&version_id=${versionId}&tab=quality`
      : `/bom?project_id=${pid}&tab=quality`;
  const pricingHref =
    versionId != null
      ? `/official-pricing?project_id=${pid}&version_id=${versionId}`
      : `/official-pricing?project_id=${pid}`;
  const exportHref = `/export?project_id=${pid}${versionId != null ? `&bom_version_id=${versionId}` : ""}`;

  const paramsForm: ProjectParamsForm = {
    name: project.name,
    customer_id: project.customer_id,
    build_quantity: String(metrics.effective_build_quantity ?? project.build_quantity),
    status: project.status,
    description: project.description ?? metrics.description ?? "",
    board_name: metrics.bom_board_name ?? "",
    source_doc_number: metrics.bom_doc_number ?? "",
    revision_code: metrics.bom_revision_code ?? "",
    active_version_id: project.active_version_id ?? "",
    version_notes: metrics.bom_version_notes ?? "",
  };

  const bomVersionLabel = [metrics.active_bom_version_name, metrics.bom_revision_code]
    .filter(Boolean)
    .join(" · ");

  const coveragePct =
    metrics.bom_non_dnp_lines > 0 && metrics.official_priced_lines != null
      ? Math.round((metrics.official_priced_lines / metrics.bom_non_dnp_lines) * 100)
      : null;

  return (
    <div className="space-y-4 pb-8">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
          {error}
        </div>
      )}

      {/* Hero */}
      <Card className="overflow-hidden border-brand/25 shadow-md">
        <div className="bg-gradient-to-l from-brand/8 via-brand/3 to-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-[10px] font-semibold text-brand tracking-wide">
                מרכז בקרה לפרויקט
              </p>
              <h1 className="text-[24px] font-bold text-navy mt-1 leading-tight">{project.name}</h1>
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 mt-2 text-[12px] text-slate-600">
                <span>
                  לקוח: <strong className="text-slate-800">{fmt(metrics.customer_name)}</strong>
                </span>
                <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                  {project.code}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <StatusBadge status={project.status} />
              {metrics.active_bom_is_active && (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-green-100 text-green-800 border border-green-200 font-medium">
                  BOM פעיל
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand text-brand-fg text-[12px] font-semibold hover:bg-brand/90 shadow-sm"
              >
                <Pencil className="h-3.5 w-3.5" /> עריכת פרמטרים
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col lg:flex-row gap-3">
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["לוח / Board", fmt(metrics.bom_board_name)],
                ["מס׳ מסמך", fmt(metrics.bom_doc_number)],
                ["BOM פעיל", fmt(bomVersionLabel || metrics.active_bom_version_name)],
                ["עודכן", fmtDate(metrics.updated_at)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white/80 border border-slate-100 px-2.5 py-2 text-right">
                  <div className="text-[10px] text-slate-500">{k}</div>
                  <div className="text-[12px] font-semibold text-slate-800 truncate" title={v}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="rounded-lg bg-brand/10 border border-brand/25 px-4 py-2 min-w-[120px] text-right">
                <div className="text-[10px] text-brand font-medium">כמות להרכבה</div>
                <div className="text-[22px] font-bold text-brand tabular-nums leading-tight mt-0.5">
                  {metrics.effective_build_quantity.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-white/80 border border-slate-100 px-3 py-2 min-w-[88px] text-right">
                <div className="text-[10px] text-slate-500">שורות BOM</div>
                <div className="text-[18px] font-bold tabular-nums text-slate-800 mt-0.5">
                  {metrics.bom_total_lines.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2.5 leading-relaxed text-right">
            כמות להרכבה משמשת כמכפיל לחישוב Required Qty — לא משנה את Qty המקורי של כל שורת BOM
          </p>
        </div>
      </Card>

      {/* Quick actions */}
      <Card className="p-2.5 shadow-sm">
        <p className="text-[10px] text-slate-500 px-1 mb-1.5 font-medium">פעולות מהירות</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "עריכת פרמטרים", onClick: () => setEditOpen(true), icon: Pencil },
            { label: "טען BOM", href: `/upload-bom?project_id=${pid}`, icon: Upload },
            { label: "טבלת BOM", href: bomHref, icon: Table2 },
            {
              label: "מחירון ספקים",
              href: pricingHref,
              icon: DollarSign,
              disabled: !versionId,
              title: !versionId ? "אין BOM פעיל" : undefined,
            },
            {
              label: "צור Snapshot",
              href: pricingHref,
              icon: Camera,
              disabled: !versionId,
              title: !versionId ? "אין BOM פעיל" : undefined,
            },
            { label: "דוחות וייצוא", href: exportHref, icon: Download },
            {
              label: "ייצוא Customer BOM Review",
              disabled: !versionId || exportBusy != null,
              title: !versionId
                ? "אין BOM פעיל"
                : exportBusy
                  ? "מייצא…"
                  : undefined,
              onClick: versionId
                ? () =>
                    quickExport("customer", "/api/exports/customer-bom-review", {
                      project_id: pid,
                      bom_version_id: versionId,
                    })
                : undefined,
              icon: FileText,
            },
            {
              label: "קובץ רכש",
              href: `/procurement-file?project_id=${pid}`,
              icon: ShoppingCart,
            },
          ].map((a) => {
            const Icon = a.icon;
            const cls =
              "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11.5px] border transition-colors " +
              (a.disabled
                ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300");
            if (a.href && !a.disabled) {
              return (
                <Link key={a.label} href={a.href} title={a.title} className={cls}>
                  <Icon className="h-3.5 w-3.5" /> {a.label}
                </Link>
              );
            }
            return (
              <button
                key={a.label}
                type="button"
                disabled={a.disabled}
                title={a.title}
                onClick={a.onClick}
                className={cls}
              >
                <Icon className="h-3.5 w-3.5" /> {a.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* KPI — BOM health */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 mb-2 px-0.5">BOM ואיכות</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <DashKpi label="שורות BOM" value={metrics.bom_total_lines} icon={<Layers className="h-4 w-4" />} />
          <DashKpi label="לא DNP" value={metrics.bom_non_dnp_lines} tone="good" icon={<CheckCircle2 className="h-4 w-4" />} />
          <DashKpi label="DNP" value={metrics.bom_dnp_count} tone="muted" icon={<Box className="h-4 w-4" />} />
          <DashKpi
            label="ציון איכות"
            value={metrics.bom_quality_score ?? "—"}
            tone={
              metrics.bom_quality_score == null ? "muted" : qualityScoreTone(metrics.bom_quality_score)
            }
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <DashKpi
            label="דורש בדיקה"
            value={metrics.bom_needs_review_count}
            tone={metrics.bom_needs_review_count > 0 ? "warn" : "good"}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* KPI — Supplier pricing */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 mb-2 px-0.5">תמחור ספקים</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <DashKpi
            label="בחירה נוכחית"
            value={fmtMoney(metrics.official_selected_total)}
            tone="good"
            icon={<DollarSign className="h-4 w-4" />}
            hint="סה״כ מחירון נוכחי"
          />
          <DashKpi
            label="שורות מתומחרות"
            value={
              coveragePct != null
                ? `${metrics.official_priced_lines ?? 0} (${coveragePct}%)`
                : (metrics.official_priced_lines ?? "—")
            }
            tone="good"
            icon={<TrendingUp className="h-4 w-4" />}
            hint="כיסוי תמחור"
          />
          <DashKpi
            label="מחירים חסרים"
            value={metrics.official_missing_prices ?? metrics.official_no_solution}
            tone={(metrics.official_missing_prices ?? metrics.official_no_solution) > 0 ? "bad" : "good"}
            icon={<XCircle className="h-4 w-4" />}
          />
          <DashKpi
            label="ללא מלאי"
            value={metrics.official_no_stock_count ?? "—"}
            tone={(metrics.official_no_stock_count ?? 0) > 0 ? "warn" : "muted"}
          />
          <DashKpi
            label="Snapshot אחרון"
            value={fmtMoney(metrics.official_snapshot_total)}
            tone={metrics.official_snapshot_total != null ? "default" : "muted"}
            icon={<Camera className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Dashboard sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionCard
          title="בריאות BOM"
          icon={<ShieldCheck className="h-4 w-4" />}
          cta={{ href: qualityHref, label: "פתח איכות BOM" }}
        >
          <QualityGauge score={metrics.bom_quality_score} />
          <dl className="grid grid-cols-2 gap-3 mt-3">
            <Stat label="תקין" value={metrics.bom_ok_count} tone="good" />
            <Stat label="אזהרות" value={metrics.bom_warning_count} tone="warn" />
            <Stat label="שגיאות" value={metrics.bom_error_count} tone="bad" />
            <Stat label="דורש בדיקה" value={metrics.bom_needs_review_count} tone="warn" />
          </dl>
        </SectionCard>

        <SectionCard
          title="תמחור ספקים"
          icon={<DollarSign className="h-4 w-4" />}
          cta={{ href: pricingHref, label: "פתח מחירון BOM מספקים" }}
        >
          {!versionId ? (
            <p className="text-slate-400 py-4 text-center">אין BOM פעיל — טען BOM תחילה</p>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="בחירה נוכחית" value={fmtMoney(metrics.official_selected_total)} />
              <Stat label="יש פתרון" value={metrics.official_has_solution} tone="good" />
              <Stat label="דורש אישור" value={metrics.official_needs_approval} tone="warn" />
              <Stat label="אין פתרון" value={metrics.official_no_solution} tone="bad" />
              <Stat label="ללא מלאי" value={metrics.official_no_stock_count ?? 0} tone="warn" />
              <Stat label="Snapshot אחרון" value={metrics.official_snapshot_name ?? "—"} />
            </dl>
          )}
        </SectionCard>

        <SectionCard
          title="ייצוא ודוחות"
          icon={<Download className="h-4 w-4" />}
          cta={{ href: exportHref, label: "דוחות וייצוא" }}
        >
          <dl className="space-y-3">
            <div className="flex justify-between items-baseline border-b border-slate-50 pb-2">
              <dt className="text-slate-500">Customer BOM Review</dt>
              <dd className="font-semibold text-[11px]">{fmtDate(metrics.latest_customer_export_at)}</dd>
            </div>
            <div className="flex justify-between items-baseline border-b border-slate-50 pb-2">
              <dt className="text-slate-500">קובץ רכש לספק</dt>
              <dd className="font-semibold text-[11px]">{fmtDate(metrics.latest_procurement_export_at)}</dd>
            </div>
            {metrics.official_snapshot_created_at && (
              <div className="flex justify-between items-baseline">
                <dt className="text-slate-500">Snapshot אחרון</dt>
                <dd className="font-semibold text-[11px]">{fmtDate(metrics.official_snapshot_created_at)}</dd>
              </div>
            )}
          </dl>
          <Link
            href={`/procurement-file?project_id=${pid}`}
            className="mt-3 inline-flex items-center gap-1 text-[11px] text-brand font-medium hover:underline"
          >
            קובץ רכש לספק
            <ChevronLeft className="h-3 w-3" />
          </Link>
        </SectionCard>

        <SectionCard
          title="קבצי פרויקט"
          icon={<Package className="h-4 w-4" />}
          cta={{ href: `/files?project_id=${pid}`, label: "קבצי פרויקט" }}
        >
          <div className="flex items-end gap-2 py-2">
            <span className="text-[36px] font-bold tabular-nums text-slate-800 leading-none">
              {metrics.project_files_count}
            </span>
            <span className="text-slate-500 text-[12px] pb-1">קבצים מצורפים</span>
          </div>
        </SectionCard>
      </div>

      <p className="text-center text-[11px] text-slate-400 pt-2">
        <Link href="/activity" className="text-brand hover:underline inline-flex items-center gap-1">
          <ClipboardList className="h-3 w-3" />
          לצפייה ביומן הפעולות המלא
        </Link>
      </p>

      {editOpen && (
        <EditProjectParamsModal
          projectId={pid}
          versionId={versionId}
          initial={paramsForm}
          onClose={() => setEditOpen(false)}
          onSaved={() => load(pid)}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const colors = {
    default: "text-slate-800",
    good: "text-green-700",
    warn: "text-amber-700",
    bad: "text-red-700",
  };
  return (
    <div className="rounded-md bg-slate-50/60 px-2 py-1.5">
      <dt className="text-slate-500 text-[10px]">{label}</dt>
      <dd className={clsx("font-bold tabular-nums text-[15px]", colors[tone])}>{value}</dd>
    </div>
  );
}

export default function ProjectOverviewPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <ProjectOverviewInner />
    </Suspense>
  );
}
