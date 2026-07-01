"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Download,
  Inbox,
  Loader2,
  Lock,
  RefreshCw,
  Star,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { CardBatchScopeBar } from "@/components/project/CardBatchScopeBar";
import { PricingModeSwitch } from "@/components/official-pricing/PricingModeSwitch";
import { SupplierOffersDrawer } from "@/components/official-pricing/SupplierOffersDrawer";
import type { WorkbenchLine } from "@/components/official-pricing/types";
import {
  SUPPLIER_FILTERS,
  fmtMoney,
  versionLabel,
  type PurchaseFileLine,
  type PurchaseFileResponse,
  type SupplierFilter,
} from "@/components/purchase-file/types";
import { apiDownloadPost, apiGet, apiPatch, apiPost, triggerBlobDownload } from "@/lib/api";
import { formatBatchLabel } from "@/lib/project-overview";
import { useProjectBatchScope } from "@/lib/use-project-batch-scope";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = { id: number; name: string };

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
  const router = useRouter();
  const params = useSearchParams();
  const urlProjectId = params.get("project_id");
  const urlCardId = params.get("card_id");
  const urlVersionId = params.get("version_id");
  const { user } = useCurrentUser();

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [versionId, setVersionId] = useState<number | null>(
    urlVersionId ? Number(urlVersionId) : null,
  );
  const [includeEast, setIncludeEast] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>("all");
  const [snapshotId, setSnapshotId] = useState<number | null>(null);
  const [data, setData] = useState<PurchaseFileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [qtySaving, setQtySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerLine, setDrawerLine] = useState<WorkbenchLine | null>(null);
  const [showHandling, setShowHandling] = useState(false);

  const lastLoadedVersionRef = useRef<number | null>(null);
  const lastFilterKeyRef = useRef<string>("");

  const needsProjectPick = !urlProjectId && !urlVersionId;

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects").then((ps) => {
      setProjects(ps);
      if (!ps.length) return;

      let nextId: number | null = null;
      if (urlProjectId) {
        const fromUrl = ps.find((p) => String(p.id) === urlProjectId);
        if (fromUrl) nextId = fromUrl.id;
      }
      if (nextId == null) {
        const saved = readSavedProjectId();
        if (saved != null && ps.some((p) => p.id === saved)) nextId = saved;
      }
      if (nextId == null) nextId = ps[0].id;

      if (needsProjectPick && nextId != null) {
        router.replace(`/procurement-file?project_id=${nextId}`);
        return;
      }
      setProjectId(nextId);
    });
  }, [urlProjectId, needsProjectPick, router]);

  useEffect(() => {
    if (projectId != null) localStorage.setItem(PROJECT_KEY, String(projectId));
  }, [projectId]);

  const scopedProjectId =
    projectId ??
    (urlProjectId && Number.isFinite(Number(urlProjectId)) ? Number(urlProjectId) : null);

  const scope = useProjectBatchScope(scopedProjectId, urlCardId, urlVersionId);

  const loadPurchaseFile = useCallback(
    async (bomVersionId: number, opts?: { silent?: boolean }) => {
      if (scopedProjectId == null) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          project_id: String(scopedProjectId),
          bom_version_id: String(bomVersionId),
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
        if (!opts?.silent) setLoading(false);
      }
    },
    [scopedProjectId, supplierFilter, includeEast, snapshotId],
  );

  useEffect(() => {
    if (needsProjectPick || scope.loading) return;
    if (!scopedProjectId) return;

    if (scope.versionId == null) {
      lastLoadedVersionRef.current = null;
      setVersionId(null);
      setData(null);
      return;
    }

    if (
      (!urlCardId || !urlVersionId) &&
      scope.cardId != null &&
      scope.versionId != null
    ) {
      const q = new URLSearchParams(params.toString());
      q.set("project_id", String(scopedProjectId));
      if (!urlCardId) q.set("card_id", String(scope.cardId));
      if (!urlVersionId) q.set("version_id", String(scope.versionId));
      router.replace(`/procurement-file?${q.toString()}`);
      return;
    }

    const filterKey = `${scope.versionId}:${supplierFilter}:${snapshotId ?? ""}:${includeEast}`;
    if (
      lastLoadedVersionRef.current === scope.versionId &&
      lastFilterKeyRef.current === filterKey
    ) {
      return;
    }
    lastLoadedVersionRef.current = scope.versionId;
    lastFilterKeyRef.current = filterKey;

    setVersionId(scope.versionId);
    void loadPurchaseFile(scope.versionId);
  }, [
    needsProjectPick,
    scope.loading,
    scope.versionId,
    scope.cardId,
    scopedProjectId,
    urlCardId,
    urlVersionId,
    params,
    router,
    loadPurchaseFile,
    supplierFilter,
    snapshotId,
    includeEast,
  ]);

  function selectProject(nextProjectId: number) {
    lastLoadedVersionRef.current = null;
    lastFilterKeyRef.current = "";
    setSnapshotId(null);
    setShowHandling(false);
    const q = new URLSearchParams();
    q.set("project_id", String(nextProjectId));
    router.replace(`/procurement-file?${q.toString()}`);
  }

  function pushScope(next: { cardId: number; versionId: number | null }) {
    if (!scopedProjectId) return;
    lastLoadedVersionRef.current = null;
    lastFilterKeyRef.current = "";
    setSnapshotId(null);
    setShowHandling(false);
    const q = new URLSearchParams(params.toString());
    q.set("project_id", String(scopedProjectId));
    q.set("card_id", String(next.cardId));
    if (next.versionId != null) q.set("version_id", String(next.versionId));
    else q.delete("version_id");
    router.replace(`/procurement-file?${q.toString()}`);
  }

  function selectCard(cardId: number) {
    pushScope({ cardId, versionId: scope.defaultBatchForCard(cardId) });
  }

  function selectBatch(batchId: number) {
    const card = scope.overview?.cards.find((c) => c.batches.some((b) => b.id === batchId));
    if (!card) return;
    pushScope({ cardId: card.id, versionId: batchId });
  }

  const refreshAll = useCallback(async () => {
    const vid = scope.versionId ?? versionId;
    if (vid == null) return;
    setRefreshing(true);
    lastFilterKeyRef.current = "";
    try {
      await scope.reload();
      await loadPurchaseFile(vid, { silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [scope.reload, scope.versionId, versionId, loadPurchaseFile]);

  async function saveBatchQuantity(qty: number) {
    const vid = scope.versionId ?? versionId;
    if (vid == null) return;
    setQtySaving(true);
    try {
      await apiPatch(`/api/bom-versions/${vid}`, { build_quantity: qty }, user.id);
      await scope.reload();
      lastFilterKeyRef.current = "";
      await loadPurchaseFile(vid, { silent: true });
    } finally {
      setQtySaving(false);
    }
  }

  const tableLines = useMemo(() => {
    if (!data) return [];
    return showHandling ? data.needs_handling_lines : data.lines;
  }, [data, showHandling]);

  async function exportExcel(supplier?: string) {
    const vid = scope.versionId ?? versionId;
    if (scopedProjectId == null || vid == null) return;
    setExportBusy(true);
    setError(null);
    try {
      const { blob, fileName } = await apiDownloadPost(
        "/api/exports/supplier-purchase-report",
        {
          project_id: scopedProjectId,
          bom_version_id: vid,
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
    const vid = scope.versionId ?? versionId;
    if (scopedProjectId == null || vid == null || !drawerLine) return;
    await apiPost(
      "/api/official-pricing/workbench/select",
      {
        project_id: scopedProjectId,
        bom_version_id: vid,
        bom_line_id: drawerLine.bom_line_id,
        offer_type: internalOnly ? "east_quote" : "supplier",
        supplier,
        manually_approved_possible_match: needsReview,
      },
      user.id,
    );
    setDrawerLine(null);
    lastFilterKeyRef.current = "";
    await loadPurchaseFile(vid, { silent: true });
  }

  async function selectSpecial(type: "tbd" | "dnp") {
    const vid = scope.versionId ?? versionId;
    if (scopedProjectId == null || vid == null || !drawerLine) return;
    await apiPost(
      "/api/official-pricing/workbench/select",
      {
        project_id: scopedProjectId,
        bom_version_id: vid,
        bom_line_id: drawerLine.bom_line_id,
        offer_type: type,
      },
      user.id,
    );
    setDrawerLine(null);
    lastFilterKeyRef.current = "";
    await loadPurchaseFile(vid, { silent: true });
  }

  function onSupplierFilterChange(next: SupplierFilter) {
    setShowHandling(false);
    setSupplierFilter(next);
    lastFilterKeyRef.current = "";
  }

  const sel = "h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white";
  const showContext = Boolean(scopedProjectId && scope.overview) && !needsProjectPick;
  const initialLoading = loading && !data;
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));
  const activeVersionId = scope.versionId ?? versionId;

  return (
    <div className="flex flex-col gap-2 min-h-0 h-[calc(100vh-7rem)] overflow-hidden -mt-2">
      <div className="flex flex-wrap items-start justify-between gap-2 shrink-0">
        <div>
          <h1 className="text-[15px] font-bold text-navy tracking-tight leading-none">קובץ רכש לספק</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            רשימות רכש פנימיות לפי כרטיס ומנה — לא ללקוח
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-300 bg-amber-50 text-[10px] text-amber-900">
          <Lock className="w-3 h-3" />
          GLINTECH INTERNAL ONLY — פנימי בלבד
        </div>
      </div>

      {needsProjectPick ? (
        <Card className="p-6 max-w-md">
          <label className="block text-[12px] text-slate-600 mb-1">פרויקט</label>
          <select
            value=""
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) selectProject(v);
            }}
            className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
          >
            <option value="">בחר פרויקט</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Card>
      ) : (
        <>
          {showContext && (
            <CardBatchScopeBar
              overview={scope.overview}
              cardId={scope.cardId}
              versionId={scope.versionId}
              loading={scope.loading || refreshing}
              onCardChange={selectCard}
              onBatchChange={selectBatch}
              projects={projectOptions}
              projectId={scopedProjectId}
              onProjectChange={selectProject}
              buildQuantity={scope.selectedBatch?.build_quantity ?? data?.bom_version.build_quantity ?? null}
              cardDefaultQuantity={scope.selectedCard?.build_quantity ?? null}
              onSaveBuildQuantity={saveBatchQuantity}
              savingQty={qtySaving}
            />
          )}

          <div className="flex flex-wrap items-end gap-2 shrink-0">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Snapshot</label>
              <select
                className={`${sel} min-w-[160px]`}
                value={snapshotId ?? ""}
                onChange={(e) => {
                  setSnapshotId(e.target.value ? Number(e.target.value) : null);
                  lastFilterKeyRef.current = "";
                }}
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
                onChange={(e) => onSupplierFilterChange(e.target.value as SupplierFilter)}
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
              disabled={activeVersionId == null || loading || refreshing}
              onClick={() => void refreshAll()}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-slate-200 text-[11px] bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              רענון
            </button>
            <button
              type="button"
              disabled={exportBusy || !data}
              onClick={() => exportExcel()}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-brand/30 text-[11px] bg-brand-soft text-brand hover:bg-brand/10 disabled:opacity-50"
            >
              {exportBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              ייצוא Excel
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-2 shrink-0">
            <PricingModeSwitch
              includeEast={includeEast}
              versionId={activeVersionId}
              userId={user.id}
              onChange={(v) => {
                setIncludeEast(v);
                lastFilterKeyRef.current = "";
              }}
              onSaved={() => {
                const vid = scope.versionId ?? versionId;
                if (vid != null) void loadPurchaseFile(vid, { silent: true });
              }}
              onError={setError}
              disabled={loading || activeVersionId == null}
            />
            {!includeEast && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-900">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                מצב רשמי בלבד — מחירי סין/מזרח לא נכללים בסה״כ רכש. שורות עם מקור מזרח בלבד יופיעו תחת «דורש טיפול».
              </div>
            )}
          </div>

          {error && (
            <div className="px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-800 text-[11px] shrink-0">
              {error}
            </div>
          )}

          {initialLoading ? (
            <div className="py-12 text-center text-slate-500 text-[13px]">
              <Loader2 className="w-5 h-5 animate-spin inline-block ml-2" />
              טוען קובץ רכש…
            </div>
          ) : scope.versionId == null && !scope.loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-[13px]">
              <Inbox className="h-7 w-7" /> לא נטען BOM לכרטיס זה עדיין
            </div>
          ) : data ? (
            <>
              <Card className="p-3 shrink-0">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-[11px]">
                  <div>
                    <div className="text-slate-500">פרויקט</div>
                    <div className="font-bold text-navy truncate">{data.project.name}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">לקוח</div>
                    <div className="truncate">{data.project.customer_name ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">כרטיס</div>
                    <div className="truncate">{scope.selectedCard?.name ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">מנה</div>
                    <div className="truncate">
                      {scope.selectedBatch ? formatBatchLabel(scope.selectedBatch) : versionLabel(data.bom_version)}
                    </div>
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
                      <div>
                        {s.lines_count} שורות · {fmtMoney(s.total)}
                      </div>
                      {s.needs_approval > 0 && <div className="text-amber-700">אישור: {s.needs_approval}</div>}
                      {s.no_stock > 0 && <div className="text-red-600">ללא מלאי: {s.no_stock}</div>}
                      {s.lead_time_summary && <div>Lead: {s.lead_time_summary}</div>}
                    </div>
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowHandling(false);
                          onSupplierFilterChange(s.supplier_key as SupplierFilter);
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
                    <div className="mt-1 text-[10px] text-amber-800">
                      {data.summary.needs_handling} שורות ללא מקור רשמי
                    </div>
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
                  מציג שורות «דורש טיפול» — מקור סין/מזרח שלא נכלל במצב רשמי בלבד.
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
                ייצוא לקוח ללא נתוני סין/מזרח — ללא שינוי.
              </p>
            </>
          ) : null}
        </>
      )}

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
