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
  ShoppingCart,
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
  include_east_pricing?: boolean;
};
type ApiSnapshot = {
  id: number;
  name: string;
  snapshot_name: string | null;
};
type WorkbenchPeek = {
  summary?: { total_lines?: number; has_solution?: number };
  include_east_pricing?: boolean;
};

const CUSTOMER_CHECKLIST = [
  "ללא Link / מזרח / China",
  "ללא עלות פנימית",
  "ללא Margin / Savings",
  "ללא Match Confidence",
  "ללא הערות פנימיות",
];

const PURCHASE_SUPPLIER_FILTERS = [
  { value: "all", label: "כל הספקים" },
  { value: "china", label: "סין / מזרח" },
  { value: "digikey", label: "Digi-Key" },
  { value: "mouser", label: "Mouser" },
  { value: "ti", label: "TI" },
  { value: "manual", label: "Manual" },
  { value: "tbd", label: "TBD / No Solution" },
] as const;

const PRICING_MODES = [
  { value: false, label: "רשמי בלבד" },
  { value: true, label: "משולב עם מחירי מזרח" },
] as const;

function ExportCard({
  title,
  description,
  warning,
  disabled,
  disabledReason,
  busy,
  busyKey,
  exportKey,
  onExport,
  buttonClassName = "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50 disabled:opacity-60",
  iconSize = "h-7 w-7",
}: {
  title: string;
  description: string;
  warning?: string;
  disabled: boolean;
  disabledReason?: string;
  busy: string | null;
  busyKey: string;
  exportKey: string;
  onExport: () => void;
  buttonClassName?: string;
  iconSize?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 mb-2">
        <FileSpreadsheet className={`${iconSize} text-brand shrink-0`} />
        <div>
          <div className="text-[13px] font-semibold">{title}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{description}</div>
        </div>
      </div>
      {warning && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-800 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {warning}
        </div>
      )}
      {disabled && disabledReason && (
        <p className="text-[11px] text-slate-500 mb-2">{disabledReason}</p>
      )}
      <button
        type="button"
        disabled={disabled || busy != null}
        onClick={onExport}
        className={buttonClassName}
      >
        {busy === busyKey ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        הורד Excel
      </button>
    </Card>
  );
}

function ExportInner() {
  const urlParams = useSearchParams();
  const urlProjectId = urlParams.get("project_id");
  const urlBomVersionId = urlParams.get("bom_version_id");
  const urlPricingSnapshotId = urlParams.get("pricing_snapshot_id");
  const { user } = useCurrentUser();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [snapshots, setSnapshots] = useState<ApiSnapshot[]>([]);
  const [workbench, setWorkbench] = useState<WorkbenchPeek | null>(null);
  const [workbenchLoading, setWorkbenchLoading] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [purchaseSupplier, setPurchaseSupplier] = useState("all");
  const [pricingIncludeEast, setPricingIncludeEast] = useState<boolean | null>(null);
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
      setWorkbench(null);
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

  const pid = projectId ? Number(projectId) : null;
  const vid = versionId ? Number(versionId) : null;
  const selectedProject = projects.find((p) => p.id === pid);
  const selectedVersion = versions.find((v) => v.id === vid);

  useEffect(() => {
    if (selectedVersion?.include_east_pricing != null) {
      setPricingIncludeEast(selectedVersion.include_east_pricing);
    }
  }, [selectedVersion?.id, selectedVersion?.include_east_pricing]);

  useEffect(() => {
    if (pid == null || vid == null) {
      setWorkbench(null);
      return;
    }
    setWorkbenchLoading(true);
    apiGet<WorkbenchPeek>(
      `/api/official-pricing/workbench?project_id=${pid}&bom_version_id=${vid}`,
    )
      .then(setWorkbench)
      .catch(() => setWorkbench(null))
      .finally(() => setWorkbenchLoading(false));
  }, [pid, vid]);

  async function runExport(
    key: string,
    path: string,
    body: Record<string, unknown>,
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

  const canBomExport = pid != null && vid != null;
  const hasPricingData =
    canBomExport &&
    !workbenchLoading &&
    (workbench?.summary?.total_lines ?? 0) > 0;
  const hasQualityData = canBomExport;
  const eastForPricing =
    pricingIncludeEast ?? selectedVersion?.include_east_pricing ?? true;
  const includeEastForPurchase =
    selectedVersion?.include_east_pricing ?? workbench?.include_east_pricing ?? true;

  const pricingDisabledReason = !canBomExport
    ? "בחר פרויקט וגרסת BOM"
    : workbenchLoading
      ? "טוען נתוני מחיר..."
      : !hasPricingData
        ? "אין נתוני מחיר"
        : undefined;

  const qualityDisabledReason = !canBomExport ? "בחר פרויקט וגרסת BOM" : undefined;

  return (
    <>
      <PageHeader
        title="דוחות וייצוא"
        subtitle="הפקת קבצי Excel — דוחות ללקוח, פנימיים ורכש"
      />

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
          {error}
        </div>
      )}

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
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
            <label className="block text-[12px] text-slate-600 mb-1">
              Pricing Snapshot (אופציונלי)
            </label>
            <select
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              disabled={!projectId}
              className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white disabled:opacity-60"
            >
              <option value="">ללא — משתמש בנתוני Workbench נוכחיים</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.snapshot_name || s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedProject && selectedVersion && (
          <div className="text-[11.5px] text-slate-600 border-t border-slate-100 pt-2">
            נבחר: <span className="font-medium">{selectedProject.name}</span> ·{" "}
            <span className="font-medium">
              {selectedVersion.version_name || selectedVersion.version_label}
            </span>
            {workbench?.summary?.total_lines != null && (
              <>
                {" "}
                · {workbench.summary.total_lines} שורות BOM
                {workbench.summary.has_solution != null && (
                  <> · {workbench.summary.has_solution} עם פתרון מחיר</>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      <div className="space-y-6">
        {/* A. Customer */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-risk-low" />
            <h2 className="text-[14px] font-semibold">דוחות לקוח</h2>
            <Badge className="bg-green-50 text-risk-low border-green-200">Customer Safe</Badge>
          </div>
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <FileSpreadsheet className="h-8 w-8 text-brand shrink-0" />
              <div>
                <div className="text-[13.5px] font-semibold">Customer BOM Cost Review Excel</div>
                <div className="text-[11.5px] text-slate-500 mt-0.5">
                  דוח ללקוח ללא עלויות פנימיות, ללא Link/מזרח, ללא Margin/Savings
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
            {!canBomExport && (
              <p className="text-[11px] text-slate-500 mb-2">בחר פרויקט וגרסת BOM</p>
            )}
            <button
              type="button"
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

        {/* B. Internal */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-amber-700" />
            <h2 className="text-[14px] font-semibold">דוחות פנימיים</h2>
            <Badge className="bg-amber-50 text-amber-800 border-amber-200">Internal Only</Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <ExportCard
              title="Internal BOM Quality Excel"
              description="סטטוס איכות, תיקונים, DNP, Needs Review, שגיאות ואזהרות"
              warning="פנימי בלבד — לא להעברה ללקוח"
              disabled={!hasQualityData || busy != null}
              disabledReason={qualityDisabledReason}
              busy={busy}
              busyKey="quality"
              exportKey="quality"
              onExport={() =>
                runExport("quality", "/api/exports/internal-bom-quality", {
                  project_id: pid!,
                  bom_version_id: vid!,
                })
              }
            />

            <div className="space-y-2">
              <ExportCard
                title="Internal Pricing Snapshot Excel"
                description="מקור נבחר, מחירים, מלאי, Lead Time, הצעות זמינות, מצב מחירון"
                warning="פנימי בלבד — עשוי לכלול Link/מזרח וחיסכון פנימי"
                disabled={!hasPricingData || busy != null}
                disabledReason={pricingDisabledReason}
                busy={busy}
                busyKey="pricing"
                exportKey="pricing"
                onExport={() =>
                  runExport("pricing", "/api/exports/internal-pricing-workbench", {
                    project_id: pid!,
                    bom_version_id: vid!,
                    include_east: eastForPricing,
                  })
                }
              />
              <div className="px-1">
                <label className="block text-[11px] text-slate-600 mb-1">מצב מחירון</label>
                <select
                  value={eastForPricing ? "east" : "official"}
                  onChange={(e) => setPricingIncludeEast(e.target.value === "east")}
                  disabled={!canBomExport}
                  className="w-full h-8 rounded-md border border-slate-200 px-2 text-[11.5px] bg-white disabled:opacity-60"
                >
                  {PRICING_MODES.map((m) => (
                    <option key={String(m.value)} value={m.value ? "east" : "official"}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ExportCard
              title="Internal Pricing Comparison Excel"
              description="השוואת רשמי מול מזרח — סיכום ושורות עם פערי מחיר"
              warning="פנימי בלבד — כולל נתוני חיסכון פנימיים"
              disabled={!hasPricingData || busy != null}
              disabledReason={pricingDisabledReason}
              busy={busy}
              busyKey="comparison"
              exportKey="comparison"
              onExport={() =>
                runExport("comparison", "/api/exports/internal-pricing-comparison", {
                  project_id: pid!,
                  bom_version_id: vid!,
                  include_east: eastForPricing,
                })
              }
            />
          </div>
        </section>

        {/* C. Procurement */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="h-4 w-4 text-navy" />
            <h2 className="text-[14px] font-semibold">דוחות רכש</h2>
            <Badge className="bg-amber-50 text-amber-800 border-amber-200">Internal Only</Badge>
          </div>
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <FileSpreadsheet className="h-8 w-8 text-brand shrink-0" />
              <div>
                <div className="text-[13.5px] font-semibold">Supplier Purchase Report Excel</div>
                <div className="text-[11.5px] text-slate-500 mt-0.5">
                  קובץ רכש פנימי לפי ספק — סיכום שורות רכש וגיליונות לפי ספק
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-800 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              פנימי בלבד — עשוי לכלול Link/מחירי מזרח וספק פנימי
            </div>
            <div className="mb-3 max-w-sm">
              <label className="block text-[11px] text-slate-600 mb-1">ספק</label>
              <select
                value={purchaseSupplier}
                onChange={(e) => setPurchaseSupplier(e.target.value)}
                disabled={!canBomExport}
                className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12px] bg-white disabled:opacity-60"
              >
                {PURCHASE_SUPPLIER_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {!hasPricingData && pricingDisabledReason && (
              <p className="text-[11px] text-slate-500 mb-2">{pricingDisabledReason}</p>
            )}
            <button
              type="button"
              disabled={!hasPricingData || busy != null}
              onClick={() =>
                runExport("purchase", "/api/exports/supplier-purchase-report", {
                  project_id: pid!,
                  bom_version_id: vid!,
                  supplier: purchaseSupplier,
                  include_east: includeEastForPurchase,
                })
              }
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] font-medium hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === "purchase" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              הורד Excel
            </button>
          </Card>
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
