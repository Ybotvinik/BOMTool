"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, Upload, Loader2, AlertTriangle, Inbox, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { PageTabs } from "@/components/PageTabs";
import { BomContextHeader } from "@/components/bom/BomContextHeader";
import { CardBatchScopeBar } from "@/components/project/CardBatchScopeBar";
import { BomQualityPanel } from "@/components/bom/BomQualityPanel";
import { BomIssuesPanel } from "@/components/bom/BomIssuesPanel";
import { BomLinesTable } from "@/components/bom/BomLinesTable";
import {
  BOM_FILTERS,
  matchesBomFilter,
  type BomFilterKey,
  type BomProjectMeta,
  type BomSummary,
  type BomVersionMeta,
} from "@/components/bom/types";
import { apiGet, apiPatch } from "@/lib/api";
import { useProjectBatchScope } from "@/lib/use-project-batch-scope";
import { formatBatchLabel } from "@/lib/project-overview";
import { useCurrentUser } from "@/lib/current-user";
import { EditBomLineModal, type QualityLine } from "@/components/EditBomLineModal";
import { ReviewBomLineModal } from "@/components/bom/ReviewBomLineModal";

type ApiCustomer = { id: number; name: string };
type Status = "idle" | "loading" | "ok" | "empty" | "error" | "pick-project" | "no-bom";

const BOM_TABS = [
  { id: "lines", label: "שורות BOM" },
  { id: "quality", label: "איכות BOM" },
  { id: "issues", label: "חריגים / בעיות" },
] as const;

type BomTab = (typeof BOM_TABS)[number]["id"];

function BomInner() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const params = useSearchParams();
  const urlProjectId = params.get("project_id");
  const urlCardId = params.get("card_id");
  const urlVersionId = params.get("version_id");
  const activeTab = (params.get("tab") as BomTab) || "lines";
  const urlFilter = params.get("filter") as BomFilterKey | null;

  const [pickerProjects, setPickerProjects] = useState<BomProjectMeta[]>([]);
  const [versionId, setVersionId] = useState<number | null>(urlVersionId ? Number(urlVersionId) : null);
  const [version, setVersion] = useState<BomVersionMeta | null>(null);
  const [project, setProject] = useState<BomProjectMeta | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [lines, setLines] = useState<QualityLine[]>([]);
  const [summary, setSummary] = useState<BomSummary | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [filter, setFilter] = useState<BomFilterKey>(urlFilter ?? "all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<QualityLine | null>(null);
  const [reviewing, setReviewing] = useState<QualityLine | null>(null);
  const [qtySaving, setQtySaving] = useState(false);

  useEffect(() => {
    if (urlFilter && BOM_FILTERS.some(([k]) => k === urlFilter)) {
      setFilter(urlFilter);
    }
  }, [urlFilter]);

  const loadLines = useCallback(async (id: number) => {
    setStatus("loading");
    try {
      const [data, sum] = await Promise.all([
        apiGet<QualityLine[]>(`/api/bom-versions/${id}/quality-lines`),
        apiGet<BomSummary & { bom_version_id?: number }>(`/api/bom-versions/${id}/quality-summary`),
      ]);
      setLines(data);
      setSummary(sum);
      setStatus(data.length > 0 ? "ok" : "empty");
    } catch (e) {
      setStatus("error");
      setErrorMsg(String(e));
    }
  }, []);

  function applyLineSaved(updated: QualityLine, newSummary: Record<string, unknown> | null) {
    setLines((prev) => prev.map((l) => (l.line_id === updated.line_id ? updated : l)));
    if (newSummary) {
      setSummary(newSummary as BomSummary);
    }
  }

  function handleLineSaved(updated: QualityLine, newSummary: Record<string, unknown> | null) {
    applyLineSaved(updated, newSummary);
    setEditing(null);
    setReviewing(null);
    if (versionId != null) loadLines(versionId);
  }

  const loadMeta = useCallback(async (id: number) => {
    try {
      const v = await apiGet<BomVersionMeta>(`/api/bom-versions/${id}`);
      setVersion(v);
      const [p, cs] = await Promise.all([
        apiGet<BomProjectMeta>(`/api/projects/${v.project_id}`),
        apiGet<ApiCustomer[]>("/api/customers"),
      ]);
      setProject(p);
      setCustomers(cs);
    } catch {
      /* header is best-effort */
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!urlProjectId && !urlVersionId) {
        setStatus("loading");
        try {
          const [ps, cs] = await Promise.all([
            apiGet<BomProjectMeta[]>("/api/projects"),
            apiGet<ApiCustomer[]>("/api/customers"),
          ]);
          setPickerProjects(ps);
          setCustomers(cs);
        } catch {
          /* ignore */
        }
        setStatus("pick-project");
        return;
      }

      if (urlProjectId && !urlVersionId) {
        try {
          const p = await apiGet<BomProjectMeta>(`/api/projects/${Number(urlProjectId)}`);
          setProject(p);
          const cs = await apiGet<ApiCustomer[]>("/api/customers");
          setCustomers(cs);
        } catch (e) {
          setStatus("error");
          setErrorMsg(String(e));
        }
        return;
      }

      if (urlVersionId && !urlProjectId) {
        try {
          const v = await apiGet<BomVersionMeta>(`/api/bom-versions/${Number(urlVersionId)}`);
          const [p, cs] = await Promise.all([
            apiGet<BomProjectMeta>(`/api/projects/${v.project_id}`),
            apiGet<ApiCustomer[]>("/api/customers"),
          ]);
          setProject(p);
          setCustomers(cs);
        } catch (e) {
          setStatus("error");
          setErrorMsg(String(e));
        }
      }
    })();
  }, [urlProjectId, urlVersionId]);

  const scopedProjectId =
    project?.id ??
    (urlProjectId && Number.isFinite(Number(urlProjectId)) ? Number(urlProjectId) : null) ??
    version?.project_id ??
    null;

  const scope = useProjectBatchScope(scopedProjectId, urlCardId, urlVersionId);

  useEffect(() => {
    if (status === "pick-project") return;
    if (scope.loading) {
      setStatus("loading");
      return;
    }
    if (!scopedProjectId) return;

    if (scope.versionId == null) {
      setVersionId(null);
      setVersion(null);
      setLines([]);
      setSummary(null);
      setStatus(scope.overview ? "no-bom" : "error");
      if (scope.error) setErrorMsg(scope.error);
      return;
    }

    // Fill defaults only when card/version missing — do not override explicit user selection.
    if (
      (!urlCardId || !urlVersionId) &&
      scope.cardId != null &&
      scope.versionId != null
    ) {
      const q = new URLSearchParams(params.toString());
      q.set("project_id", String(scopedProjectId));
      if (!urlCardId) q.set("card_id", String(scope.cardId));
      if (!urlVersionId) q.set("version_id", String(scope.versionId));
      router.replace(`/bom?${q.toString()}`);
      return;
    }

    setVersionId(scope.versionId);
    loadMeta(scope.versionId);
    loadLines(scope.versionId);
  }, [
    scope.loading,
    scope.versionId,
    scope.cardId,
    scope.overview,
    scope.error,
    scopedProjectId,
    status,
    urlCardId,
    urlVersionId,
    params,
    router,
    loadLines,
    loadMeta,
  ]);

  function pushScope(next: { cardId: number; versionId: number | null }) {
    if (!scopedProjectId) return;
    const q = new URLSearchParams(params.toString());
    q.set("project_id", String(scopedProjectId));
    q.set("card_id", String(next.cardId));
    if (next.versionId != null) q.set("version_id", String(next.versionId));
    else q.delete("version_id");
    if (activeTab !== "lines") q.set("tab", activeTab);
    else q.delete("tab");
    q.delete("filter");
    router.replace(`/bom?${q.toString()}`);
  }

  function selectCard(cardId: number) {
    setFilter("all");
    pushScope({ cardId, versionId: scope.defaultBatchForCard(cardId) });
  }

  function selectBatch(batchId: number) {
    setFilter("all");
    const card = scope.overview?.cards.find((c) => c.batches.some((b) => b.id === batchId));
    if (!card) return;
    pushScope({ cardId: card.id, versionId: batchId });
  }

  async function saveBatchQuantity(qty: number) {
    if (versionId == null) return;
    setQtySaving(true);
    try {
      await apiPatch(`/api/bom-versions/${versionId}`, { build_quantity: qty }, user.id);
      await scope.reload();
      await loadMeta(versionId);
      await loadLines(versionId);
    } finally {
      setQtySaving(false);
    }
  }

  function navigateToFilter(next: BomFilterKey) {
    setFilter(next);
    const q = new URLSearchParams(params.toString());
    q.set("tab", "lines");
    if (next !== "all") q.set("filter", next);
    else q.delete("filter");
    router.push(`/bom?${q.toString()}`);
  }

  const customerName = scope.overview?.customer_name ?? (project ? customers.find((c) => c.id === project.customer_id)?.name : null);

  const tabQuery = {
    project_id: scopedProjectId,
    card_id: scope.cardId,
    version_id: scope.versionId ?? versionId,
  };

  const showContext = Boolean(scopedProjectId && scope.overview) && status !== "pick-project";

  const rows = lines;
  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (!matchesBomFilter(r, filter)) return false;
    if (q) {
      const hay = [r.original_mpn, r.cleaned_mpn, r.manufacturer, r.original_description, r.reference_designators]
        .map((x) => (x ?? "").toLowerCase())
        .join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="טבלת BOM"
        subtitle="נתוני BOM, ניתוח איכות וחריגים"
        actions={
          <>
            <button
              type="button"
              onClick={() => versionId != null && loadLines(versionId)}
              disabled={versionId == null || status === "loading"}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> רענון
            </button>
            <Link
              href={
                scopedProjectId && scope.cardId && scope.versionId
                  ? `/upload-bom?project_id=${scopedProjectId}&card_id=${scope.cardId}&version_id=${scope.versionId}`
                  : scopedProjectId
                    ? `/upload-bom?project_id=${scopedProjectId}`
                    : "/upload-bom"
              }
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90"
            >
              <Upload className="h-3.5 w-3.5" /> טעינת BOM
            </Link>
          </>
        }
      />

      <PageTabs tabs={[...BOM_TABS]} activeTab={activeTab} basePath="/bom" query={tabQuery} />

      {showContext && (
        <CardBatchScopeBar
          overview={scope.overview}
          cardId={scope.cardId}
          versionId={scope.versionId}
          loading={scope.loading}
          onCardChange={selectCard}
          onBatchChange={selectBatch}
          buildQuantity={scope.selectedBatch?.build_quantity ?? version?.build_quantity ?? null}
          cardDefaultQuantity={scope.selectedCard?.build_quantity ?? null}
          onSaveBuildQuantity={saveBatchQuantity}
          savingQty={qtySaving}
        />
      )}

      {showContext && status !== "no-bom" && (
        <BomContextHeader
          project={project}
          customerName={customerName ?? null}
          cardName={scope.selectedCard?.name ?? null}
          batchLabel={scope.selectedBatch ? formatBatchLabel(scope.selectedBatch) : null}
          version={version}
          summary={summary}
          loading={status === "loading" || scope.loading}
        />
      )}

      {status === "pick-project" && (
        <Card className="p-6 max-w-md mb-3">
          <label className="block text-[12px] text-slate-600 mb-1">פרויקט</label>
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) {
                const p = new URLSearchParams();
                p.set("project_id", v);
                if (activeTab !== "lines") p.set("tab", activeTab);
                router.push(`/bom?${p.toString()}`);
              }
            }}
            className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
          >
            <option value="">בחר פרויקט</option>
            {pickerProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </Card>
      )}

      {activeTab === "quality" && (
        <BomQualityPanel
          versionId={versionId}
          summary={summary}
          rows={rows}
          loading={status === "loading"}
          tabQuery={tabQuery}
          onReload={() => versionId != null && loadLines(versionId)}
          onFilterNavigate={navigateToFilter}
          onEdit={setEditing}
          onReview={setReviewing}
        />
      )}

      {activeTab === "issues" && (
        <BomIssuesPanel
          versionId={versionId}
          tabQuery={tabQuery}
          summary={summary}
          onEdit={setEditing}
          onReview={setReviewing}
        />
      )}

      {activeTab === "lines" && (
        <>
          {(status === "ok" || status === "empty") && summary && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {BOM_FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={
                    "h-7 px-2.5 rounded-md text-[11.5px] border " +
                    (filter === key
                      ? "bg-brand text-brand-fg border-brand"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")
                  }
                >
                  {label}
                  {key !== "all" && summary && (
                    <span className="ms-1 opacity-70 tabular-nums">
                      (
                      {key === "ok"
                        ? summary.ok_count ?? 0
                        : key === "error"
                          ? summary.error_count ?? 0
                          : key === "warning"
                            ? summary.warning_count ?? 0
                            : key === "needs_review"
                              ? summary.needs_review_count ?? 0
                              : key === "dnp"
                                ? summary.dnp_count ?? 0
                                : key === "missing_mpn"
                                  ? summary.missing_mpn_count ?? 0
                                  : key === "missing_qty"
                                    ? summary.missing_qty_count ?? 0
                                    : 0}
                      )
                    </span>
                  )}
                </button>
              ))}
              <div className="relative ms-auto">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש MPN / יצרן / תיאור / RefDes"
                  className="h-8 w-64 rounded-md border border-slate-200 ps-7 pe-2 text-[12px]"
                />
              </div>
            </div>
          )}

          <Card className="overflow-hidden">
            {status === "loading" ? (
              <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
                <Loader2 className="h-4 w-4 animate-spin" /> טוען שורות BOM...
              </div>
            ) : status === "pick-project" ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-[13px]">
                <Inbox className="h-7 w-7" /> בחר פרויקט
              </div>
            ) : status === "no-bom" ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-[13px]">
                <Inbox className="h-7 w-7" /> לא נטען BOM לפרויקט זה עדיין
              </div>
            ) : status === "error" ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-red-600 text-[13px]">
                <AlertTriangle className="h-7 w-7" /> טעינת שורות ה-BOM נכשלה
                <span className="text-[11px] text-red-500 font-mono">{errorMsg}</span>
              </div>
            ) : status === "empty" ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-[13px]">
                <Inbox className="h-7 w-7" /> לא נמצאו שורות BOM עבור גרסה זו.
              </div>
            ) : (
              <div className="max-h-[calc(100vh-14rem)] overflow-auto">
                <BomLinesTable
                  rows={filtered}
                  onEdit={setEditing}
                  onReview={setReviewing}
                />
              </div>
            )}
          </Card>
        </>
      )}

      {editing && (
        <EditBomLineModal
          line={editing}
          onClose={() => setEditing(null)}
          onSaved={handleLineSaved}
        />
      )}

      {reviewing && (
        <ReviewBomLineModal
          line={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={handleLineSaved}
        />
      )}
    </>
  );
}

export default function BomTablePage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <BomInner />
    </Suspense>
  );
}
