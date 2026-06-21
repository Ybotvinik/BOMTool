"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  RefreshCw,
  Globe,
  AlertTriangle,
  Database,
  FileDown,
  Search,
  MoreHorizontal,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { PageTabs } from "@/components/PageTabs";
import { SupplierOffersDrawer } from "@/components/official-pricing/SupplierOffersDrawer";
import { EastQuotesPanel, type EastQuoteRow } from "@/components/official-pricing/EastQuotesPanel";
import { PricingModeSwitch } from "@/components/official-pricing/PricingModeSwitch";
import { PricingComparisonCards } from "@/components/official-pricing/PricingComparisonCards";
import { SingleComponentCheckPanel } from "@/components/official-pricing/SingleComponentCheckPanel";
import {
  FILTERS,
  fmtPrice,
  matchesFilter,
  type ConfigStatus,
  type FilterKey,
  type WorkbenchLine,
  type WorkbenchSummary,
  type PricingComparison,
} from "@/components/official-pricing/types";
import { apiDownloadPost, apiGet, apiPatch, apiPost, triggerBlobDownload } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import {
  readLastOfficialPricingProjectId,
  readLastOfficialPricingVersionId,
  saveOfficialPricingContext,
} from "@/lib/official-pricing-context";

type ApiProject = { id: number; name: string };
type ApiVersion = { id: number; version_label: string; version_name: string | null; is_active: boolean };

type WorkbenchResponse = {
  project_id: number;
  bom_version_id: number;
  config: ConfigStatus;
  summary: WorkbenchSummary;
  lines: WorkbenchLine[];
  include_east_pricing: boolean;
  east_quotes: EastQuoteRow[];
  pricing_comparison: PricingComparison | null;
};

type FetchResponse = {
  query_ids: number[];
  total_lines: number;
  priced_count: number;
  missing_count: number;
  error_count: number;
  is_mock: boolean;
};

type SnapshotResponse = {
  snapshot_id: number;
  priced_count: number;
  missing_price_count: number;
  needs_review_count: number;
  official_components_total: number;
  is_mock: boolean;
};

const OFFICIAL_PRICING_TABS = [
  { id: "workbench", label: "מחירון BOM" },
  { id: "component-check", label: "בדיקת רכיב בודד" },
] as const;

type OfficialPricingTab = (typeof OFFICIAL_PRICING_TABS)[number]["id"];

function CompactKpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "muted";
}) {
  const toneClass = {
    default: "text-slate-800",
    good: "text-green-700",
    warn: "text-amber-700",
    bad: "text-red-700",
    muted: "text-slate-500",
  }[tone];
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] whitespace-nowrap">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

function SourceBadge({ source, internal }: { source: string; internal?: boolean }) {
  const map: Record<string, string> = {
    "Digi-Key": "bg-blue-50 text-blue-700 border-blue-200",
    Mouser: "bg-violet-50 text-violet-700 border-violet-200",
    TI: "bg-red-50 text-red-700 border-red-200",
    Link: "bg-amber-50 text-amber-800 border-amber-200",
    Manual: "bg-sky-50 text-sky-700 border-sky-200",
    TBD: "bg-slate-100 text-slate-600 border-slate-300",
    DNP: "bg-slate-200 text-slate-500 border-slate-300",
  };
  const style =
    map[source] ??
    (internal
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : source.startsWith("Manual")
        ? map.Manual
        : "bg-slate-100 text-slate-700 border-slate-200");
  return (
    <span className="inline-flex items-center gap-0.5 flex-wrap" title="מקור המחיר שנבחר לשורת BOM זו">
      <Badge className={style}>{source}</Badge>
      {internal && (
        <>
          <span className="text-[8px] px-1 py-px rounded bg-amber-100 text-amber-800 border border-amber-200 leading-tight">
            פנימי
          </span>
          <span className="text-[8px] px-1 py-px rounded bg-slate-100 text-slate-600 border border-slate-200 leading-tight">
            מזרח
          </span>
        </>
      )}
    </span>
  );
}

function LineStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Priced: "bg-green-50 text-green-700 border-green-200",
    "Needs Review": "bg-amber-50 text-amber-700 border-amber-200",
    Missing: "bg-red-50 text-red-700 border-red-200",
    Manual: "bg-blue-50 text-blue-700 border-blue-200",
    DNP: "bg-slate-200 text-slate-600 border-slate-300",
    "No Stock": "bg-orange-50 text-orange-700 border-orange-200",
  };
  return <Badge className={map[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}>{status}</Badge>;
}

function SolutionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Has Solution": "bg-green-50 text-green-700 border-green-200",
    "Needs Approval": "bg-amber-50 text-amber-700 border-amber-200",
    "No Solution": "bg-red-50 text-red-700 border-red-200",
    DNP: "bg-slate-200 text-slate-600 border-slate-300",
  };
  return <Badge className={map[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}>{status}</Badge>;
}

function RowActionsMenu({
  onSelectSupplier,
  onEditMpn,
  onRefetch,
}: {
  onSelectSupplier: () => void;
  onEditMpn: () => void;
  onRefetch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="flex items-center gap-0.5" ref={ref}>
      <button
        type="button"
        onClick={onSelectSupplier}
        className="h-6 px-2 rounded-md bg-brand/10 text-brand text-[10px] font-medium hover:bg-brand/15 whitespace-nowrap"
      >
        בחר ספק
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-6 w-6 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
          aria-label="פעולות נוספות"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {open && (
          <div className="absolute end-0 top-full mt-0.5 z-20 min-w-[132px] rounded-md border border-slate-200 bg-white shadow-md py-0.5">
            <button
              type="button"
              onClick={() => {
                onEditMpn();
                setOpen(false);
              }}
              className="w-full px-2.5 py-1.5 text-[10px] text-slate-700 hover:bg-slate-50 text-start"
            >
              עדכן MPN
            </button>
            <button
              type="button"
              onClick={() => {
                onRefetch();
                setOpen(false);
              }}
              className="w-full px-2.5 py-1.5 text-[10px] text-slate-700 hover:bg-slate-50 text-start"
            >
              משוך שוב מחיר
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OfficialPricingPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <OfficialPricingPageInner />
    </Suspense>
  );
}

function OfficialPricingPageInner() {
  const urlProjectId = useSearchParams().get("project_id");
  const activeTab = (useSearchParams().get("tab") as OfficialPricingTab | null) ?? "workbench";
  const { user } = useCurrentUser();

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [versionId, setVersionId] = useState<number | null>(null);

  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [lines, setLines] = useState<WorkbenchLine[]>([]);
  const [summary, setSummary] = useState<WorkbenchSummary | null>(null);
  const [fetchResult, setFetchResult] = useState<FetchResponse | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [snapshotName, setSnapshotName] = useState("Supplier Pricing Snapshot");

  const [suppliers, setSuppliers] = useState({ digikey: true, mouser: true, ti: true });
  const [mode, setMode] = useState<"all" | "missing_only">("all");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drawerLine, setDrawerLine] = useState<WorkbenchLine | null>(null);
  const [mpnEditLine, setMpnEditLine] = useState<WorkbenchLine | null>(null);
  const [mpnOverride, setMpnOverride] = useState("");
  const [manualLine, setManualLine] = useState<WorkbenchLine | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [includeEast, setIncludeEast] = useState(false);
  const [eastQuotes, setEastQuotes] = useState<EastQuoteRow[]>([]);
  const [pricingComparison, setPricingComparison] = useState<PricingComparison | null>(null);
  const [manualForm, setManualForm] = useState({
    supplier_name: "",
    supplier_part_number: "",
    unit_price: "",
    currency: "USD",
    stock: "",
    lead_time: "",
    note: "",
  });

  const selCompact = "h-7 rounded-md border border-slate-200 px-2 text-[11px] bg-white";
  const sel = `${selCompact} w-full`;

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
        const savedId = readLastOfficialPricingProjectId();
        if (savedId != null && ps.some((p) => p.id === savedId)) nextId = savedId;
      }
      if (nextId == null) nextId = ps[0].id;
      setProjectId(nextId);
    });
    apiGet<ConfigStatus>("/api/official-pricing/status").then(setConfig).catch(() => setConfig(null));
  }, [urlProjectId]);

  useEffect(() => {
    if (projectId == null) return;
    const savedVersionId = readLastOfficialPricingVersionId(projectId);
    apiGet<ApiVersion[]>(`/api/bom-versions?project_id=${projectId}`).then((vs) => {
      setVersions(vs);
      const fromSaved =
        savedVersionId != null ? vs.find((v) => v.id === savedVersionId) : undefined;
      const active = vs.find((v) => v.is_active) ?? vs[vs.length - 1];
      setVersionId((fromSaved ?? active)?.id ?? null);
    });
  }, [projectId]);

  useEffect(() => {
    if (projectId != null) saveOfficialPricingContext(projectId, versionId);
  }, [projectId, versionId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === versionId) ?? null,
    [versions, versionId],
  );

  const loadWorkbench = useCallback(async () => {
    if (projectId == null || versionId == null) return;
    const data = await apiGet<WorkbenchResponse>(
      `/api/official-pricing/workbench?project_id=${projectId}&bom_version_id=${versionId}`,
    );
    setConfig(data.config);
    setLines(data.lines);
    setSummary(data.summary);
    setIncludeEast(data.include_east_pricing);
    setEastQuotes(data.east_quotes ?? []);
    setPricingComparison(data.pricing_comparison ?? null);
  }, [projectId, versionId]);

  useEffect(() => {
    loadWorkbench().catch(() => {
      setLines([]);
      setSummary(null);
    });
  }, [loadWorkbench]);

  const updateLine = (row: WorkbenchLine) => {
    setLines((prev) => prev.map((l) => (l.bom_line_id === row.bom_line_id ? row : l)));
    if (drawerLine?.bom_line_id === row.bom_line_id) setDrawerLine(row);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines.filter((ln) => {
      if (!matchesFilter(ln, filter)) return false;
      if (!q) return true;
      const hay = [ln.mpn, ln.manufacturer, ln.description, ln.source, ln.supplier_part_number]
        .map((x) => (x ?? "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [lines, filter, query]);

  const noStockCount = useMemo(() => lines.filter((ln) => ln.status === "No Stock").length, [lines]);

  const selectedSuppliers = useMemo(
    () => [
      ...(suppliers.digikey ? ["digikey"] : []),
      ...(suppliers.mouser ? ["mouser"] : []),
      ...(suppliers.ti ? ["ti"] : []),
    ],
    [suppliers],
  );

  const credentialsMissing =
    config &&
    !config.mock_mode &&
    ((suppliers.digikey && config.digikey.credentials_missing) ||
      (suppliers.mouser && config.mouser.credentials_missing) ||
      (suppliers.ti && config.ti.credentials_missing));

  async function doFetch() {
    if (projectId == null || versionId == null) return;
    const selected = selectedSuppliers;
    if (!selected.length) {
      setError("יש לבחור לפחות ספק אחד");
      return;
    }
    setBusy(true);
    setError(null);
    setFetchResult(null);
    try {
      const res = await apiPost<FetchResponse>(
        "/api/official-pricing/fetch",
        { project_id: projectId, bom_version_id: versionId, suppliers: selected, mode },
        user.id,
      );
      setFetchResult(res);
      await loadWorkbench();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function doSnapshot() {
    if (projectId == null || versionId == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<SnapshotResponse>(
        "/api/official-pricing/create-snapshot",
        {
          project_id: projectId,
          bom_version_id: versionId,
          snapshot_name: snapshotName,
          supplier_priority: selectedSuppliers,
        },
        user.id,
      );
      setSnapshot(res);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function doWorkbenchExport() {
    if (projectId == null || versionId == null) return;
    setBusy(true);
    try {
      const { blob, fileName } = await apiDownloadPost(
        "/api/exports/supplier-pricing-workbench",
        { project_id: projectId, bom_version_id: versionId },
        user.id,
      );
      triggerBlobDownload(blob, fileName);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function selectOffer(supplier: string, needsReview: boolean, internalOnly?: boolean) {
    if (projectId == null || versionId == null || !drawerLine) return;
    const row = await apiPost<WorkbenchLine>(
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
    updateLine(row);
    setDrawerLine(null);
    await loadWorkbench();
  }

  async function selectSpecial(offerType: "tbd" | "dnp") {
    if (projectId == null || versionId == null || !drawerLine) return;
    const row = await apiPost<WorkbenchLine>(
      "/api/official-pricing/workbench/select",
      {
        project_id: projectId,
        bom_version_id: versionId,
        bom_line_id: drawerLine.bom_line_id,
        offer_type: offerType,
      },
      user.id,
    );
    updateLine(row);
    setDrawerLine(null);
    await loadWorkbench();
  }

  async function saveManual() {
    if (projectId == null || versionId == null || !manualLine) return;
    if (!manualForm.supplier_name.trim()) {
      setManualError("שם ספק הוא שדה חובה");
      return;
    }
    const unit = Number(manualForm.unit_price);
    if (manualForm.unit_price === "" || Number.isNaN(unit) || unit < 0) {
      setManualError("מחיר יחידה חייב להיות מספר תקין (≥ 0)");
      return;
    }
    setManualBusy(true);
    setManualError(null);
    try {
      const row = await apiPost<WorkbenchLine>(
        "/api/official-pricing/workbench/manual",
        {
          project_id: projectId,
          bom_version_id: versionId,
          bom_line_id: manualLine.bom_line_id,
          supplier_name: manualForm.supplier_name.trim(),
          supplier_part_number: manualForm.supplier_part_number.trim() || null,
          unit_price: unit,
          currency: manualForm.currency.trim() || "USD",
          stock: manualForm.stock ? Number(manualForm.stock) : null,
          lead_time: manualForm.lead_time.trim() || null,
          note: manualForm.note.trim() || null,
        },
        user.id,
      );
      updateLine(row);
      await loadWorkbench();
      setManualLine(null);
      setDrawerLine(null);
    } catch (e) {
      setManualError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setManualBusy(false);
    }
  }

  async function saveMpnOverride() {
    if (projectId == null || versionId == null || !mpnEditLine) return;
    const row = await apiPatch<WorkbenchLine>(
      "/api/official-pricing/workbench/mpn-override",
      {
        project_id: projectId,
        bom_version_id: versionId,
        bom_line_id: mpnEditLine.bom_line_id,
        search_mpn_override: mpnOverride.trim() || null,
      },
      user.id,
    );
    updateLine(row);
    setMpnEditLine(null);
    await loadWorkbench();
  }

  async function refetchLine(ln: WorkbenchLine) {
    if (projectId == null || versionId == null) return;
    setBusy(true);
    try {
      const row = await apiPost<WorkbenchLine>(
        "/api/official-pricing/workbench/fetch-line",
        {
          project_id: projectId,
          bom_version_id: versionId,
          bom_line_id: ln.bom_line_id,
          suppliers: selectedSuppliers,
        },
        user.id,
      );
      updateLine(row);
      await loadWorkbench();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 min-h-0 -mt-2 h-[calc(100vh-7rem)] overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-3 shrink-0">
        <div className="min-w-0 justify-self-start">
          <h1 className="text-[15px] font-bold text-navy tracking-tight leading-none">מחירון BOM מספקים</h1>
        </div>

        <div className="min-w-0 text-center px-2">
          {selectedProject ? (
            <>
              <div
                className="text-[22px] font-bold text-navy leading-tight truncate"
                title={selectedProject.name}
              >
                {selectedProject.name}
              </div>
              {activeTab === "workbench" && selectedVersion && (
                <div className="mt-0.5 text-[13px] font-medium text-slate-600 truncate" title={selectedVersion.version_name ?? undefined}>
                  {selectedVersion.version_label}
                  {selectedVersion.version_name ? ` · ${selectedVersion.version_name}` : ""}
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] text-slate-500">טוען פרויקט…</p>
          )}
        </div>

        <div className="flex justify-end gap-1.5 justify-self-end">
        {activeTab === "workbench" && (
          <>
            <button
              type="button"
              onClick={() => loadWorkbench()}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 text-[11px] bg-white hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> רענון
            </button>
            <button
              type="button"
              disabled={busy || !lines.length}
              onClick={doWorkbenchExport}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 text-[11px] bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" /> ייצוא Workbench
            </button>
          </>
        )}
        </div>
      </div>

      <PageTabs
        tabs={[...OFFICIAL_PRICING_TABS]}
        activeTab={activeTab}
        basePath="/official-pricing"
        query={{ project_id: projectId }}
      />

      {activeTab === "component-check" ? (
        <SingleComponentCheckPanel config={config} />
      ) : (
        <>

      {(config?.mock_mode || (!config?.mock_mode && credentialsMissing)) && (
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {config?.mock_mode && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-200 bg-red-50 text-[11px] text-red-800">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> מצב דמו — המחירים אינם אמיתיים
            </div>
          )}
          {!config?.mock_mode && credentialsMissing && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-200 bg-amber-50 text-[11px] text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              API credentials missing — הגדר DIGIKEY_CLIENT_ID / MOUSER_API_KEY ב-.env
            </div>
          )}
        </div>
      )}

      {error && <div className="px-2 py-0.5 rounded-md border border-red-200 bg-red-50 text-red-800 text-[11px] shrink-0">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-2 shrink-0">
        <PricingModeSwitch
          includeEast={includeEast}
          versionId={versionId}
          userId={user.id}
          onChange={setIncludeEast}
          onSaved={() => loadWorkbench().catch(() => {})}
          onError={setError}
          disabled={busy}
        />
        <EastQuotesPanel
          projectId={projectId}
          versionId={versionId}
          userId={user.id}
          quotes={eastQuotes}
          onChanged={() => loadWorkbench().catch(() => {})}
          onError={setError}
        />
      </div>

      <PricingComparisonCards comparison={pricingComparison} activeModeEast={includeEast} />

      <Card className="p-1.5 flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 mb-1 shrink-0">
          <select className={`${selCompact} min-w-[120px] flex-1 max-w-[180px]`} title="פרויקט" value={projectId ?? ""} onChange={(e) => setProjectId(Number(e.target.value))}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select className={`${selCompact} min-w-[120px] flex-1 max-w-[180px]`} title="גרסת BOM" value={versionId ?? ""} onChange={(e) => setVersionId(Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.version_name || v.version_label}{v.is_active ? " ★" : ""}
              </option>
            ))}
          </select>
          <select className={`${selCompact} w-[108px]`} title="מצב משיכה" value={mode} onChange={(e) => setMode(e.target.value as "all" | "missing_only")}>
            <option value="all">כל השורות</option>
            <option value="missing_only">חסרות מחיר</option>
          </select>
          <label className="inline-flex items-center gap-1 text-[10.5px]">
            <input type="checkbox" checked={suppliers.digikey} onChange={(e) => setSuppliers((s) => ({ ...s, digikey: e.target.checked }))} />
            Digi-Key
          </label>
          <label className="inline-flex items-center gap-1 text-[10.5px]">
            <input type="checkbox" checked={suppliers.mouser} onChange={(e) => setSuppliers((s) => ({ ...s, mouser: e.target.checked }))} />
            Mouser
          </label>
          <label className="inline-flex items-center gap-1 text-[10.5px]">
            <input type="checkbox" checked={suppliers.ti} onChange={(e) => setSuppliers((s) => ({ ...s, ti: e.target.checked }))} />
            TI
          </label>
          <button
            type="button"
            disabled={busy || projectId == null || versionId == null}
            onClick={doFetch}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-brand text-white text-[11px] disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            משוך מחירים
          </button>
          {fetchResult && (
            <>
              <span className="text-slate-200">|</span>
              <CompactKpi label="נשלפו" value={String(fetchResult.total_lines)} tone="muted" />
              <CompactKpi label="מתומחרות" value={String(fetchResult.priced_count)} tone="good" />
              <CompactKpi label="חסרות" value={String(fetchResult.missing_count)} tone="warn" />
              <CompactKpi label="שגיאות" value={String(fetchResult.error_count)} tone="bad" />
            </>
          )}
        </div>

        {summary && (
          <div className="flex flex-wrap items-center gap-1 mb-1 shrink-0">
            <CompactKpi label="Has Solution" value={String(summary.has_solution)} tone="good" />
            <CompactKpi label="Needs Approval" value={String(summary.needs_approval)} tone="warn" />
            <CompactKpi label="No Solution" value={String(summary.no_solution)} tone="bad" />
            <CompactKpi label="DNP" value={String(summary.dnp)} tone="muted" />
            <CompactKpi label="No Stock" value={String(noStockCount)} tone="warn" />
            {snapshot && (
              <>
                <span className="text-slate-200 mx-0.5">|</span>
                <CompactKpi label="Last Snapshot Total" value={fmtPrice(snapshot.official_components_total)} tone="muted" />
                <CompactKpi label="Last Snapshot Priced" value={String(snapshot.priced_count)} tone="good" />
                <CompactKpi label="Last Snapshot Missing" value={String(snapshot.missing_price_count)} tone="warn" />
                <CompactKpi label="Last Snapshot Needs Review" value={String(snapshot.needs_review_count)} tone="warn" />
              </>
            )}
            <span className="text-[10px] text-slate-400 ms-auto tabular-nums">
              {filtered.length !== lines.length
                ? `מציג ${filtered.length} מתוך ${lines.length} שורות`
                : `${lines.length} שורות`}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1 mb-1 pb-1 border-b border-slate-100 shrink-0">
          <input
            className={`${selCompact} w-36`}
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            placeholder="שם Snapshot"
            title="שם Snapshot"
          />
          <button
            type="button"
            disabled={busy || !lines.length}
            onClick={doSnapshot}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-300 bg-white text-[10.5px] hover:bg-slate-50 disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5" /> צור Snapshot
          </button>
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={
                "h-6 px-1.5 rounded-md text-[10px] border " +
                (filter === key ? "bg-brand text-brand-fg border-brand" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")
              }
            >
              {label}
            </button>
          ))}
          <div className="relative ms-auto">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש MPN / יצרן / Source"
              className="h-7 w-44 rounded-md border border-slate-200 ps-7 pe-2 text-[10.5px]"
            />
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
          <table className="w-full text-[11px] border-collapse table-fixed min-w-[1660px]">
            <colgroup>
              <col style={{ width: 48 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 300 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 88 }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgb(226_232_240)]">
              <tr className="text-slate-500 text-right">
                <th className="py-1 px-1.5 font-medium">#</th>
                <th className="py-1 px-1.5 font-medium">MPN</th>
                <th className="py-1 px-1.5 font-medium">Manufacturer</th>
                <th className="py-1 px-1.5 font-medium">Description</th>
                <th className="py-1 px-1.5 font-medium">Req Qty</th>
                <th className="py-1 px-1.5 font-medium">DNP</th>
                <th className="py-1 px-1.5 font-medium" title="מקור המחיר שנבחר לשורת BOM זו">
                  Source
                </th>
                <th className="py-1 px-1.5 font-medium">Supplier PN</th>
                <th className="py-1 px-1.5 font-medium">Unit Price</th>
                <th className="py-1 px-1.5 font-medium">Extended Price</th>
                <th className="py-1 px-1.5 font-medium">Stock</th>
                <th className="py-1 px-1.5 font-medium">Status</th>
                <th className="py-1 px-1.5 font-medium">Solution Status</th>
                <th className="py-1 px-1.5 font-medium">Notes</th>
                <th className="py-1 px-1.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ln) => (
                <tr key={ln.bom_line_id} className={`border-b border-slate-100 ${ln.dnp ? "bg-slate-50 text-slate-400" : "hover:bg-slate-50/60"}`}>
                  <td className="py-1 px-1.5 tabular-nums align-top">{ln.line_no ?? "—"}</td>
                  <td className="py-1 px-1.5 align-top">
                    <div className="font-mono text-[10.5px] truncate" title={ln.mpn ?? undefined}>{ln.mpn ?? "—"}</div>
                    {ln.search_mpn_override_active && (
                      <div className="text-[9px] text-amber-600 truncate" title={ln.search_mpn ?? undefined}>Search: {ln.search_mpn}</div>
                    )}
                  </td>
                  <td className="py-1 px-1.5 align-top truncate" title={ln.manufacturer ?? undefined}>{ln.manufacturer ?? "—"}</td>
                  <td className="py-1 px-1.5 align-top truncate" title={ln.description ?? undefined}>{ln.description ?? "—"}</td>
                  <td className="py-1 px-1.5 tabular-nums align-top">{ln.required_qty ?? "—"}</td>
                  <td className="py-1 px-1.5 align-top text-center">{ln.dnp ? "✓" : "—"}</td>
                  <td className="py-1 px-1.5 align-top">
                    <SourceBadge source={ln.source} internal={ln.source_is_internal} />
                  </td>
                  <td className="py-1 px-1.5 align-top font-mono text-[10px] truncate" title={ln.supplier_part_number ?? undefined}>{ln.supplier_part_number ?? "—"}</td>
                  <td className="py-1 px-1.5 align-top tabular-nums">{fmtPrice(ln.unit_price, ln.currency)}</td>
                  <td className="py-1 px-1.5 align-top tabular-nums">{fmtPrice(ln.extended_price, ln.currency)}</td>
                  <td className="py-1 px-1.5 align-top tabular-nums">{ln.stock ?? "—"}</td>
                  <td className="py-1 px-1.5 align-top"><LineStatusBadge status={ln.status} /></td>
                  <td className="py-1 px-1.5 align-top"><SolutionStatusBadge status={ln.solution_status} /></td>
                  <td className="py-1 px-1.5 align-top truncate text-[10px] text-slate-500" title={ln.notes ?? undefined}>{ln.notes ?? "—"}</td>
                  <td className="py-1 px-1.5 align-top">
                    <RowActionsMenu
                      onSelectSupplier={() => setDrawerLine(ln)}
                      onEditMpn={() => {
                        setMpnEditLine(ln);
                        setMpnOverride(ln.search_mpn_override ?? "");
                      }}
                      onRefetch={() => refetchLine(ln)}
                    />
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={15} className="py-6 text-center text-slate-400">
                    אין שורות — בחר פרויקט וגרסת BOM
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <SupplierOffersDrawer
        line={drawerLine}
        includeEast={includeEast}
        onClose={() => setDrawerLine(null)}
        onSelectSupplier={selectOffer}
        onSelectTbd={() => selectSpecial("tbd")}
        onSelectDnp={() => selectSpecial("dnp")}
        onOpenManual={() => {
          if (drawerLine) {
            setManualLine(drawerLine);
            setManualError(null);
            setManualForm({
              supplier_name:
                drawerLine.selected_source_type === "manual" && drawerLine.notes
                  ? drawerLine.notes.split(" — ")[0]
                  : "",
              supplier_part_number: drawerLine.supplier_part_number ?? "",
              unit_price: drawerLine.unit_price != null ? String(drawerLine.unit_price) : "",
              currency: drawerLine.currency || "USD",
              stock: drawerLine.stock != null ? String(drawerLine.stock) : "",
              lead_time: drawerLine.lead_time ?? "",
              note: drawerLine.notes ?? "",
            });
          }
        }}
      />

      {mpnEditLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMpnEditLine(null)} />
          <Card className="relative w-full max-w-md p-4 z-10">
            <h3 className="text-[14px] font-bold mb-1">עדכן MPN לחיפוש</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              BOM MPN: <span className="font-mono">{mpnEditLine.mpn}</span> — לא משנה את ה-BOM המקורי
            </p>
            <input
              className={sel}
              value={mpnOverride}
              onChange={(e) => setMpnOverride(e.target.value)}
              placeholder="Search MPN override"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button type="button" onClick={() => setMpnEditLine(null)} className="h-8 px-3 rounded-md border text-[12px]">ביטול</button>
              <button type="button" onClick={saveMpnOverride} className="h-8 px-3 rounded-md bg-brand text-white text-[12px]">שמור</button>
            </div>
          </Card>
        </div>
      )}

      {manualLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setManualLine(null)} />
          <Card className="relative w-full max-w-md p-4 z-10 space-y-2">
            <h3 className="text-[14px] font-bold">מקור ידני (Manual)</h3>
            {manualError && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-2 py-1.5">
                {manualError}
              </p>
            )}
            {[
              ["supplier_name", "שם ספק", "text"],
              ["supplier_part_number", "מק״ט ספק", "text"],
              ["unit_price", "מחיר יחידה", "number"],
              ["currency", "מטבע", "text"],
              ["stock", "מלאי", "number"],
              ["lead_time", "Lead Time", "text"],
              ["note", "הערה", "text"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-[11px] text-slate-500">{label}</label>
                <input
                  className={sel}
                  type={key === "unit_price" || key === "stock" ? "number" : "text"}
                  value={manualForm[key as keyof typeof manualForm]}
                  onChange={(e) => setManualForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2 justify-end">
              <button
                type="button"
                onClick={() => setManualLine(null)}
                disabled={manualBusy}
                className="h-8 px-3 rounded-md border text-[12px] disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={saveManual}
                disabled={manualBusy}
                className="h-8 px-3 rounded-md bg-brand text-white text-[12px] disabled:opacity-50"
              >
                {manualBusy ? "שומר…" : "שמור"}
              </button>
            </div>
          </Card>
        </div>
      )}
        </>
      )}
    </div>
  );
}
