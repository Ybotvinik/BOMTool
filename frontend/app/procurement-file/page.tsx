"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Download,
  Loader2,
  Lock,
  RefreshCw,
  Star,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { PricingModeSwitch } from "@/components/official-pricing/PricingModeSwitch";
import { SupplierOffersDrawer } from "@/components/official-pricing/SupplierOffersDrawer";
import type { WorkbenchLine } from "@/components/official-pricing/types";
import {
  SUPPLIER_FILTERS,
  fmtDateTime,
  fmtMoney,
  versionLabel,
  type PurchaseFileLine,
  type PurchaseFileResponse,
  type SupplierFilter,
} from "@/components/purchase-file/types";
import { apiDownloadPost, apiGet, apiPost, triggerBlobDownload } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = { id: number; name: string };
type ApiVersion = {
  id: number;
  version_label: string;
  version_name: string | null;
  is_active: boolean;
};

const PROJECT_KEY = "glintech.procurement.projectId";

function readSavedProjectId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const n = Number(localStorage.getItem(PROJECT_KEY));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function toWorkbenchLine(row: PurchaseFileLine): WorkbenchLine {
  return {
    bom_line_id: row.bom_line_id,
    line_no: row.line_number,
    mpn: row.mpn,
    cleaned_mpn: null,
    search_mpn: row.mpn,
    search_mpn_override: null,
    search_mpn_override_active: false,
    manufacturer: row.manufacturer,
    description: row.description,
    required_qty: row.required_qty,
    dnp: row.solution_status === "DNP",
    source: row.source ?? "—",
    supplier_part_number: row.supplier_part_number,
    unit_price: row.unit_price,
    extended_price: row.extended_price,
    stock: row.stock,
    currency: row.currency,
    lead_time: row.lead_time,
    status: row.status ?? "—",
    solution_status: row.solution_status ?? "—",
    notes: row.notes,
    selected_supplier: row.supplier,
    selected_source_type: row.source_type,
    user_selected: false,
    offers: row.offers ?? [],
    source_is_internal: row.internal_only,
  };
}

function CompactKpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "warn" | "bad" | "muted";
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

function ProcurementFileInner() {
  const params = useSearchParams();
  const urlProjectId = params.get("project_id");
  const { user } = useCurrentUser();

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [includeEast, setIncludeEast] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>("all");
  const [snapshotId, setSnapshotId] = useState<number | null>(null);
  const [data, setData] = useState<PurchaseFileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerLine, setDrawerLine] = useState<WorkbenchLine | null>(null);
  const [showHandling, setShowHandling] = useState(false);

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects").then((ps) => {
      setProjects(ps);
      if (!ps.length) return;
      let next: number | null = null;
      if (urlProjectId) {
        const fromUrl = ps.find((p) => String(p.id) === urlProjectId);
        if (fromUrl) next = fromUrl.id;
      }
      if (next == null) {
        const saved = readSavedProjectId();
        if (saved != null && ps.some((p) => p.id === saved)) next = saved;
      }
      if (next == null) next = ps[0].id;
      setProjectId(next);
    });
  }, [urlProjectId]);

  useEffect(() => {
    if (projectId == null) return;
    localStorage.setItem(PROJECT_KEY, String(projectId));
    apiGet<ApiVersion[]>(`/api/bom-versions?project_id=${projectId}`).then((vs) => {
      setVersions(vs);
      const active = vs.find((v) => v.is_active) ?? vs[vs.length - 1];
      setVersionId(active?.id ?? null);
    });
  }, [projectId]);

  const load = useCallback(async () => {
    if (projectId == null || versionId == null) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        project_id: String(projectId),
        bom_version_id: String(versionId),
        supplier: supplierFilter,
        include_east: String(includeEast),
      });
      if (snapshotId != null) qs.set("snapshot_id", String(snapshotId));
      const res = await apiGet<PurchaseFileResponse>(`/api/purchase-file?${qs}`);
      setData(res);
      setIncludeEast(res.include_east);
    } catch (e) {
      setData(null);
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setLoading(false);
    }
  }, [projectId, versionId, supplierFilter, includeEast, snapshotId]);

  useEffect(() => {
    load();
  }, [load]);

  const tableLines = useMemo(() => {
    if (!data) return [];
    if (showHandling) return data.needs_handling_lines;
    return data.lines;
  }, [data, showHandling]);

  async function exportExcel(supplier?: string) {
    if (projectId == null || versionId == null) return;
    setExportBusy(true);
    setError(null);
    try {
      const { blob, fileName } = await apiDownloadPost(
        "/api/exports/supplier-purchase-report",
        {
          project_id: projectId,
          bom_version_id: versionId,
          supplier: supplier ?? supplierFilter,
          include_east: includeEast,
        },
        user.id,
      );
      triggerBlobDownload(blob, fileName);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setExportBusy(false);
    }
  }

  async function selectOffer(supplier: string, needsReview: boolean, internalOnly?: boolean) {
    if (projectId == null || versionId == null || !drawerLine) return;
    await apiPost(
      "/api/official-pricing/workbench/select",
      {
        project_id: projectId,
        bom_version_id: versionId,
        bom_line_id: drawerLine.bom_line_id,
        offer_type: internalOnly ? "east_quote" : "supplier",
        supplier,
        manually_approved_possible_match: needsReview,
      },
      user.id,
    );
    setDrawerLine(null);
    await load();
  }

  async function selectSpecial(type: "tbd" | "dnp") {
    if (projectId == null || versionId == null || !drawerLine) return;
    await apiPost(
      "/api/official-pricing/workbench/select",
      {
        project_id: projectId,
        bom_version_id: versionId,
        bom_line_id: drawerLine.bom_line_id,
        offer_type: type,
      },
      user.id,
    );
    setDrawerLine(null);
    await load();
  }

  const sel = "h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white";

  return (
    <div className="flex flex-col gap-2 min-h-0 h-[calc(100vh-7rem)] overflow-hidden -mt-2">
      <div className="flex flex-wrap items-start justify-between gap-2 shrink-0">
        <div>
          <h1 className="text-[15px] font-bold text-navy tracking-tight leading-none">קובץ רכש לספק</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">רשימות רכש פנימיות לפי ספק נבחר — לא ללקוח</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-300 bg-amber-50 text-[10px] text-amber-900">
          <Lock className="w-3 h-3" />
          GLINTECH INTERNAL ONLY — פנימי בלבד
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 shrink-0">
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">פרויקט</label>
          <select
            className={`${sel} min-w-[180px]`}
            value={projectId ?? ""}
            onChange={(e) => setProjectId(Number(e.target.value) || null)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">גרסת BOM</label>
          <select
            className={`${sel} min-w-[140px]`}
            value={versionId ?? ""}
            onChange={(e) => setVersionId(Number(e.target.value) || null)}
            disabled={!versions.length}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {versionLabel(v)}
                {v.is_active ? " ★" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Snapshot</label>
          <select
            className={`${sel} min-w-[160px]`}
            value={snapshotId ?? ""}
            onChange={(e) => setSnapshotId(e.target.value ? Number(e.target.value) : null)}
            disabled={!data?.available_snapshots.length}
          >
            <option value="">ללא (מחירון חי)</option>
            {data?.available_snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.snapshot_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">סינון ספק</label>
          <select
            className={`${sel} min-w-[140px]`}
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value as SupplierFilter)}
          >
            {SUPPLIER_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => load()}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-slate-200 text-[11px] bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          רענון
        </button>
        <button
          type="button"
          disabled={exportBusy || !data}
          onClick={() => exportExcel()}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-brand/30 text-[11px] bg-brand-soft text-brand hover:bg-brand/10 disabled:opacity-50"
        >
          {exportBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          ייצוא Excel
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-2 shrink-0">
        <PricingModeSwitch
          includeEast={includeEast}
          versionId={versionId}
          userId={user.id}
          onChange={setIncludeEast}
          onSaved={() => load()}
          onError={setError}
          disabled={loading}
        />
        {!includeEast && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            מצב רשמי בלבד — Link/מזרח לא נכללים בסה״כ רכש. שורות עם מקור מזרח בלבד יופיעו תחת «דורש טיפול».
          </div>
        )}
      </div>

      {error && (
        <div className="px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-800 text-[11px] shrink-0">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="py-12 text-center text-slate-500 text-[13px]">
          <Loader2 className="w-5 h-5 animate-spin inline-block ml-2" />
          טוען קובץ רכש…
        </div>
      ) : data ? (
        <>
          <Card className="p-3 shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-[11px]">
              <div>
                <div className="text-slate-500">פרויקט</div>
                <div className="font-bold text-navy truncate">{data.project.name}</div>
              </div>
              <div>
                <div className="text-slate-500">לקוח</div>
                <div className="truncate">{data.project.customer_name ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">גרסת BOM</div>
                <div className="flex items-center gap-1 truncate">
                  {versionLabel(data.bom_version)}
                  {data.bom_version.is_project_active && (
                    <Star className="w-3 h-3 text-brand fill-brand shrink-0" />
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-500">כמות להרכבה</div>
                <div className="font-medium tabular-nums">{data.bom_version.build_quantity ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">מצב תמחור</div>
                <div className="font-medium">{data.pricing_mode}</div>
              </div>
              <div>
                <div className="text-slate-500">עודכן</div>
                <div>{fmtDateTime(data.generated_at)}</div>
              </div>
              <div>
                <div className="text-slate-500">סה״כ רכש</div>
                <div className="font-bold text-navy tabular-nums">{fmtMoney(data.summary.grand_total)}</div>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap gap-1.5 shrink-0">
            <CompactKpi label="מוכן לרכש" value={data.summary.ready_lines} tone="good" />
            <CompactKpi label="דורש אישור" value={data.summary.needs_approval} tone="warn" />
            <CompactKpi label="ללא מלאי" value={data.summary.no_stock} tone="bad" />
            <CompactKpi label="ללא פתרון" value={data.summary.no_solution} tone="bad" />
            <CompactKpi label="דורש טיפול" value={data.summary.needs_handling} tone="warn" />
            <CompactKpi label="DNP (לא ברכש)" value={data.summary.dnp_excluded} tone="muted" />
            <CompactKpi label="שורות רכש" value={data.summary.purchase_lines} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 shrink-0">
            {data.supplier_summaries.map((s) => (
              <Card key={s.supplier_key} className="p-2.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[12px] font-bold text-navy">{s.supplier}</span>
                  {s.internal_only && (
                    <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[9px]">פנימי</Badge>
                  )}
                </div>
                <div className="mt-1 text-[10px] text-slate-500 space-y-0.5">
                  <div>{s.lines_count} שורות · {fmtMoney(s.total)}</div>
                  {s.needs_approval > 0 && <div className="text-amber-700">אישור: {s.needs_approval}</div>}
                  {s.no_stock > 0 && <div className="text-red-600">ללא מלאי: {s.no_stock}</div>}
                  {s.lead_time_summary && <div>Lead: {s.lead_time_summary}</div>}
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowHandling(false);
                      setSupplierFilter(s.supplier_key as SupplierFilter);
                    }}
                    className="h-6 px-2 rounded border border-slate-200 text-[10px] bg-white hover:bg-slate-50"
                  >
                    הצג שורות
                  </button>
                  <button
                    type="button"
                    onClick={() => exportExcel(s.supplier_key)}
                    className="h-6 px-2 rounded border border-slate-200 text-[10px] bg-white hover:bg-slate-50"
                  >
                    ייצוא
                  </button>
                </div>
              </Card>
            ))}
            {data.summary.needs_handling > 0 && (
              <Card className="p-2.5 border-amber-200 bg-amber-50/50">
                <span className="text-[12px] font-bold text-amber-900">דורש טיפול</span>
                <div className="mt-1 text-[10px] text-amber-800">{data.summary.needs_handling} שורות ללא מקור רשמי</div>
                <button
                  type="button"
                  onClick={() => setShowHandling(true)}
                  className="mt-2 h-6 px-2 rounded border border-amber-300 text-[10px] bg-white hover:bg-amber-50"
                >
                  הצג שורות
                </button>
              </Card>
            )}
            {data.summary.dnp_excluded > 0 && (
              <Card className="p-2.5 border-slate-200 bg-slate-50">
                <span className="text-[12px] font-bold text-slate-600">DNP</span>
                <div className="mt-1 text-[10px] text-slate-500">{data.summary.dnp_excluded} שורות — לא ברכש</div>
              </Card>
            )}
          </div>

          {showHandling && (
            <div className="text-[11px] text-amber-800 shrink-0">
              מציג שורות «דורש טיפול» — מקור מזרח/Link שלא נכלל במצב רשמי בלבד.
              <button type="button" className="mr-2 underline" onClick={() => setShowHandling(false)}>
                חזרה לשורות רכש
              </button>
            </div>
          )}

          <Card className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="p-2 text-right font-medium w-8">#</th>
                    <th className="p-2 text-right font-medium">ספק</th>
                    <th className="p-2 text-right font-medium">MPN</th>
                    <th className="p-2 text-right font-medium">יצרן</th>
                    <th className="p-2 text-right font-medium min-w-[120px]">תיאור</th>
                    <th className="p-2 text-right font-medium">Designators</th>
                    <th className="p-2 text-right font-medium">כמות</th>
                    <th className="p-2 text-right font-medium">Supplier PN</th>
                    <th className="p-2 text-right font-medium">מחיר יח׳</th>
                    <th className="p-2 text-right font-medium">סה״כ</th>
                    <th className="p-2 text-right font-medium">מלאי</th>
                    <th className="p-2 text-right font-medium">Lead</th>
                    <th className="p-2 text-right font-medium">סטטוס</th>
                    <th className="p-2 text-right font-medium">פתרון</th>
                    <th className="p-2 text-right font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLines.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="p-8 text-center text-slate-500">
                        אין שורות להצגה
                      </td>
                    </tr>
                  ) : (
                    tableLines.map((row, idx) => (
                      <tr key={row.bom_line_id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="p-2 text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <span>{row.source ?? "—"}</span>
                            {row.internal_only && (
                              <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[9px]">פנימי</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-2 max-w-[90px] truncate">{row.mpn ?? "—"}</td>
                        <td className="p-2 max-w-[80px] truncate">{row.manufacturer ?? "—"}</td>
                        <td className="p-2 max-w-[140px] truncate" title={row.description ?? undefined}>
                          {row.description ?? "—"}
                        </td>
                        <td className="p-2 font-mono text-[10px] max-w-[80px] truncate">{row.designators ?? "—"}</td>
                        <td className="p-2 tabular-nums">{row.required_qty ?? "—"}</td>
                        <td className="p-2 max-w-[80px] truncate">{row.supplier_part_number ?? "—"}</td>
                        <td className="p-2 tabular-nums">{fmtMoney(row.unit_price, row.currency)}</td>
                        <td className="p-2 tabular-nums font-medium">{fmtMoney(row.extended_price, row.currency)}</td>
                        <td className="p-2 tabular-nums">{row.stock ?? "—"}</td>
                        <td className="p-2">{row.lead_time ?? "—"}</td>
                        <td className="p-2">{row.status ?? "—"}</td>
                        <td className="p-2">{row.solution_status ?? "—"}</td>
                        <td className="p-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setDrawerLine(toWorkbenchLine(row))}
                            className="text-brand hover:underline text-[10px]"
                          >
                            בחירת ספק
                          </button>
                          <span className="text-slate-300 mx-1">|</span>
                          <span className="text-slate-400 text-[10px]" title="בקרוב">
                            מאושר לרכש
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-[10px] text-slate-400 shrink-0">
            <Link href="/export" className="text-brand hover:underline">
              דוחות וייצוא
            </Link>
            {" · "}
            ייצוא לקוח ללא נתוני מזרח/פנימי — ללא שינוי.
          </p>
        </>
      ) : null}

      <SupplierOffersDrawer
        line={drawerLine}
        includeEast={includeEast}
        onClose={() => setDrawerLine(null)}
        onSelectSupplier={selectOffer}
        onSelectTbd={() => selectSpecial("tbd")}
        onSelectDnp={() => selectSpecial("dnp")}
        onOpenManual={() => {}}
      />
    </div>
  );
}

export default function ProcurementFilePage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <ProcurementFileInner />
    </Suspense>
  );
}
