"use client";

import { useEffect, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  ShieldCheck,
  AlertTriangle,
  ShoppingCart,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { apiDownloadPost, apiGet, triggerBlobDownload } from "@/lib/api";

type WorkbenchPeek = {
  summary?: { total_lines?: number; has_solution?: number; priced_lines?: number };
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

type Props = {
  projectId: number | null;
  versionId: number | null;
  projectName?: string;
  versionLabel?: string;
  userId: number;
  showWorkbenchExport?: boolean;
  compact?: boolean;
};

export function OfficialPricingExportPanel({
  projectId,
  versionId,
  projectName,
  versionLabel,
  userId,
  showWorkbenchExport = false,
  compact = false,
}: Props) {
  const [workbench, setWorkbench] = useState<WorkbenchPeek | null>(null);
  const [workbenchLoading, setWorkbenchLoading] = useState(false);
  const [purchaseSupplier, setPurchaseSupplier] = useState("all");
  const [pricingIncludeEast, setPricingIncludeEast] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId == null || versionId == null) {
      setWorkbench(null);
      return;
    }
    setWorkbenchLoading(true);
    apiGet<WorkbenchPeek>(
      `/api/official-pricing/workbench?project_id=${projectId}&bom_version_id=${versionId}`,
    )
      .then((data) => {
        setWorkbench(data);
        if (data.include_east_pricing != null) {
          setPricingIncludeEast(data.include_east_pricing);
        }
      })
      .catch(() => setWorkbench(null))
      .finally(() => setWorkbenchLoading(false));
  }, [projectId, versionId]);

  async function runExport(
    key: string,
    path: string,
    body: Record<string, unknown>,
  ) {
    setBusy(key);
    setError(null);
    try {
      const { blob, fileName } = await apiDownloadPost(path, body, userId);
      triggerBlobDownload(blob, fileName);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  const canExport = projectId != null && versionId != null;
  const hasBomLines = (workbench?.summary?.total_lines ?? 0) > 0;
  const hasPricedLines = (workbench?.summary?.has_solution ?? 0) > 0;
  const eastForPricing = pricingIncludeEast ?? workbench?.include_east_pricing ?? true;
  const includeEastForPurchase = workbench?.include_east_pricing ?? true;

  const scopeDisabledReason = !canExport ? "בחר פרויקט, כרטיס ומנה" : undefined;
  const pricingDisabledReason = scopeDisabledReason
    ? scopeDisabledReason
    : workbenchLoading
      ? "טוען נתוני מחיר..."
      : !hasPricedLines
        ? "אין שורות עם פתרון מחיר — משוך מחירים או בחר הצעה ב-workbench"
        : undefined;

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
          {error}
        </div>
      )}

      {canExport && (projectName || versionLabel) && (
        <div className="text-[11.5px] text-slate-600">
          {projectName && (
            <>
              נבחר: <span className="font-medium">{projectName}</span>
            </>
          )}
          {versionLabel && (
            <>
              {" "}
              · <span className="font-medium">{versionLabel}</span>
            </>
          )}
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

      {showWorkbenchExport && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="h-4 w-4 text-brand" />
            <h2 className="text-[14px] font-semibold">ייצוא מחירון BOM</h2>
          </div>
          <ExportCard
            title="Supplier Pricing Workbench Excel"
            description="ייצוא מחירון BOM — תבנית GlinTech Internal (כותרת, מטא-דאטה, KPIs)"
            disabled={!canExport || !hasBomLines || busy != null}
            disabledReason={
              scopeDisabledReason ??
              (!hasBomLines && !workbenchLoading ? "אין שורות BOM במנה זו" : undefined)
            }
            busy={busy}
            busyKey="workbench"
            onExport={() =>
              runExport("workbench", "/api/exports/supplier-pricing-workbench", {
                project_id: projectId!,
                bom_version_id: versionId!,
              })
            }
          />
        </section>
      )}

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
                תבנית GlinTech הרשמית — כותרת, סיכום מחירים, נוסחאות Components Total / Batch Price
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
          {!hasPricedLines && canExport && !workbenchLoading && (
            <p className="text-[11px] text-amber-800 mb-2">
              אין פתרונות מחיר — הקובץ יכלול שורות ללא מחיר. משוך מחירים ובחר הצעות, או צור Snapshot.
            </p>
          )}
          {scopeDisabledReason && (
            <p className="text-[11px] text-slate-500 mb-2">{scopeDisabledReason}</p>
          )}
          <button
            type="button"
            disabled={!canExport || busy != null}
            onClick={() =>
              runExport("customer", "/api/exports/customer-bom-review", {
                project_id: projectId!,
                bom_version_id: versionId!,
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
          <h2 className="text-[14px] font-semibold">דוחות פנימיים</h2>
          <Badge className="bg-amber-50 text-amber-800 border-amber-200">Internal Only</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <ExportCard
            title="Internal BOM Quality Excel"
            description="סטטוס איכות, תיקונים, DNP, Needs Review, שגיאות ואזהרות"
            warning="פנימי בלבד — לא להעברה ללקוח"
            disabled={!canExport || busy != null}
            disabledReason={scopeDisabledReason}
            busy={busy}
            busyKey="quality"
            onExport={() =>
              runExport("quality", "/api/exports/internal-bom-quality", {
                project_id: projectId!,
                bom_version_id: versionId!,
              })
            }
          />

          <div className="space-y-2">
            <ExportCard
              title="Internal Pricing Snapshot Excel"
              description="מקור נבחר, מחירים, מלאי, Lead Time, הצעות זמינות, מצב מחירון"
              warning="פנימי בלבד — עשוי לכלול Link/מזרח וחיסכון פנימי"
              disabled={!hasPricedLines || busy != null}
              disabledReason={pricingDisabledReason}
              busy={busy}
              busyKey="pricing"
              onExport={() =>
                runExport("pricing", "/api/exports/internal-pricing-workbench", {
                  project_id: projectId!,
                  bom_version_id: versionId!,
                  include_east: eastForPricing,
                })
              }
            />
            <div className="px-1">
              <label className="block text-[11px] text-slate-600 mb-1">מצב מחירון</label>
              <select
                value={eastForPricing ? "east" : "official"}
                onChange={(e) => setPricingIncludeEast(e.target.value === "east")}
                disabled={!canExport}
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
            disabled={!hasPricedLines || busy != null}
            disabledReason={pricingDisabledReason}
            busy={busy}
            busyKey="comparison"
            onExport={() =>
              runExport("comparison", "/api/exports/internal-pricing-comparison", {
                project_id: projectId!,
                bom_version_id: versionId!,
                include_east: eastForPricing,
              })
            }
          />
        </div>
      </section>

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
              disabled={!canExport}
              className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12px] bg-white disabled:opacity-60"
            >
              {PURCHASE_SUPPLIER_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {pricingDisabledReason && (
            <p className="text-[11px] text-slate-500 mb-2">{pricingDisabledReason}</p>
          )}
          <button
            type="button"
            disabled={!hasPricedLines || busy != null}
            onClick={() =>
              runExport("purchase", "/api/exports/supplier-purchase-report", {
                project_id: projectId!,
                bom_version_id: versionId!,
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
  );
}
