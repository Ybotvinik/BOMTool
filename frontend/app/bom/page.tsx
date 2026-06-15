"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Upload, Loader2, AlertTriangle, Inbox, Pencil, Check, Search } from "lucide-react";
import { Card, PageHeader, Kpi, Badge } from "@/components/ui";
import { API_URL, apiGet, apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import { EditBomLineModal, type QualityLine } from "@/components/EditBomLineModal";

type ApiVersion = {
  id: number;
  project_id: number;
  version_label: string;
  version_name: string | null;
  revision_code: string | null;
  source_doc_number: string | null;
  board_name: string | null;
  source_file_name: string | null;
  revised_date: string | null;
  build_quantity: number | null;
  status: string;
  is_active: boolean;
};
type ApiProject = { id: number; name: string; code: string; customer_id: number; active_version_id: number | null };
type ApiCustomer = { id: number; name: string };
type ApiLine = Record<string, unknown>;
type Summary = Record<string, number>;
type Status = "idle" | "loading" | "ok" | "empty" | "error" | "no-version";

const s = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v));

function toQuality(l: ApiLine): QualityLine {
  return {
    line_id: Number(l.id),
    line_number: l.line_no == null ? null : Number(l.line_no),
    original_mpn: (l.mpn as string) ?? null,
    cleaned_mpn: (l.cleaned_mpn as string) ?? null,
    manufacturer: (l.manufacturer as string) ?? null,
    original_description: (l.description as string) ?? null,
    qty_per_assembly: l.quantity == null ? null : Number(l.quantity),
    required_qty: l.required_qty == null ? null : Number(l.required_qty),
    reference_designators: (l.reference_designators as string) ?? null,
    footprint: (l.footprint as string) ?? null,
    value_text: (l.value as string) ?? null,
    is_dnp: l.dnp === true,
    quality_status: (l.quality_status as string) ?? "ok",
    needs_review: l.needs_review === true,
    review_reason: (l.review_reason as string) ?? null,
    notes: (l.notes as string) ?? null,
  };
}

function StatusBadge({ status }: { status: string }) {
  if (status === "error")
    return <Badge className="bg-red-50 text-risk-critical border-red-200">Error</Badge>;
  if (status === "warning")
    return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Warning</Badge>;
  return <Badge className="bg-green-50 text-risk-low border-green-200">OK</Badge>;
}

const FILTERS = [
  ["all", "הכל"],
  ["error", "Errors"],
  ["warning", "Warnings"],
  ["needs_review", "Needs Review"],
  ["dnp", "DNP"],
  ["missing_mpn", "Missing MPN"],
  ["missing_qty", "Missing Qty"],
] as const;

function BomInner() {
  const params = useSearchParams();
  const urlVersionId = params.get("version_id");
  const { user } = useCurrentUser();

  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [versionId, setVersionId] = useState<number | null>(urlVersionId ? Number(urlVersionId) : null);
  const [version, setVersion] = useState<ApiVersion | null>(null);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [lines, setLines] = useState<ApiLine[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastUrl, setLastUrl] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<QualityLine | null>(null);

  const loadLines = useCallback(async (id: number) => {
    const path = `/api/bom-versions/${id}/lines`;
    setLastUrl(`${API_URL}${path}`);
    setStatus("loading");
    try {
      const [data, sum] = await Promise.all([
        apiGet<ApiLine[]>(path),
        apiGet<Summary>(`/api/bom-versions/${id}/quality-summary`),
      ]);
      setLines(data);
      setSummary(sum);
      setStatus(data.length > 0 ? "ok" : "empty");
    } catch (e) {
      setStatus("error");
      setErrorMsg(String(e));
    }
  }, []);

  const loadMeta = useCallback(async (id: number) => {
    try {
      const v = await apiGet<ApiVersion>(`/api/bom-versions/${id}`);
      setVersion(v);
      const [p, cs] = await Promise.all([
        apiGet<ApiProject>(`/api/projects/${v.project_id}`),
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
      let vs: ApiVersion[] = [];
      try {
        vs = await apiGet<ApiVersion[]>("/api/bom-versions");
        setVersions(vs);
      } catch {
        /* ignore */
      }
      let id: number | null = urlVersionId ? Number(urlVersionId) : null;
      if (id == null) {
        try {
          const projects = await apiGet<ApiProject[]>("/api/projects");
          id = projects[0]?.active_version_id ?? null;
        } catch {
          /* ignore */
        }
      }
      if (id == null) {
        setStatus("no-version");
        return;
      }
      setVersionId(id);
      loadMeta(id);
      loadLines(id);
    })();
  }, [urlVersionId, loadLines, loadMeta]);

  function selectVersion(id: number) {
    setVersionId(id);
    setFilter("all");
    loadMeta(id);
    loadLines(id);
  }

  async function markReviewed(lineId: number) {
    try {
      await apiPost(`/api/bom-lines/${lineId}/mark-reviewed`, {}, user.id);
      if (versionId) loadLines(versionId);
    } catch (e) {
      alert(String(e).replace(/^Error:\s*/, ""));
    }
  }

  const customerName = project ? customers.find((c) => c.id === project.customer_id)?.name : null;

  const rows = lines.map(toQuality);
  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (filter === "error" && r.quality_status !== "error") return false;
    if (filter === "warning" && r.quality_status !== "warning") return false;
    if (filter === "needs_review" && !r.needs_review) return false;
    if (filter === "dnp" && !r.is_dnp) return false;
    if (filter === "missing_mpn" && (r.review_reason ?? "").indexOf("Missing MPN") < 0) return false;
    if (filter === "missing_qty" && (r.review_reason ?? "").indexOf("Missing Qty") < 0) return false;
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
        subtitle="נתוני BOM אמיתיים + ניתוח איכות"
        actions={
          <>
            {versions.length > 0 && (
              <select
                value={versionId ?? ""}
                onChange={(e) => selectVersion(Number(e.target.value))}
                className="h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white"
              >
                <option value="" disabled>בחר גרסה</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_name ?? v.version_label} (#{v.id}){v.is_active ? " ★" : ""}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => versionId != null && loadLines(versionId)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> רענון
            </button>
            <Link href="/quality" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50">
              איכות BOM
            </Link>
            <Link href="/upload-bom" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90">
              <Upload className="h-3.5 w-3.5" /> טעינת BOM
            </Link>
          </>
        }
      />

      {/* Version header */}
      {version && (
        <Card className="p-3 mb-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1.5 text-[11.5px]">
            <Meta label="פרויקט" value={project?.name} />
            <Meta label="לקוח" value={customerName} />
            <Meta label="קוד פרויקט" value={project?.code} />
            <Meta label="BOM Version" value={version.version_name ?? version.version_label} />
            <Meta label="Revision" value={version.revision_code} />
            <Meta label="Doc Number" value={version.source_doc_number} />
            <Meta label="Board Name" value={version.board_name} />
            <Meta label="Source File" value={version.source_file_name} />
            <Meta label="Build Quantity" value={version.build_quantity?.toString()} />
          </div>
        </Card>
      )}

      {/* Quality cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
        <Kpi label="Total Lines" value={summary?.total_lines ?? rows.length} />
        <Kpi label="Quality Score" value={summary?.quality_score ?? "—"} tone={(summary?.quality_score ?? 100) >= 90 ? "good" : (summary?.quality_score ?? 0) >= 70 ? "warn" : "bad"} />
        <Kpi label="Errors" value={summary?.error_count ?? 0} tone="bad" />
        <Kpi label="Warnings" value={summary?.warning_count ?? 0} tone="warn" />
        <Kpi label="Needs Review" value={summary?.needs_review_count ?? 0} tone="warn" />
        <Kpi label="DNP" value={summary?.dnp_count ?? 0} />
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={
              "h-7 px-2.5 rounded-md text-[11.5px] border " +
              (filter === key ? "bg-brand text-brand-fg border-brand" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")
            }
          >
            {label}
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

      <Card className="overflow-hidden">
        {status === "loading" ? (
          <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
            <Loader2 className="h-4 w-4 animate-spin" /> טוען שורות BOM...
          </div>
        ) : status === "no-version" ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-[13px]">
            <Inbox className="h-7 w-7" /> לא נבחרה גרסת BOM. ייבא קובץ BOM או בחר גרסה.
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
          <div className="overflow-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-right">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Original MPN</th>
                  <th className="px-2 py-2 font-medium">Cleaned MPN</th>
                  <th className="px-2 py-2 font-medium">Manufacturer</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium text-center">Qty</th>
                  <th className="px-2 py-2 font-medium text-center">Req Qty</th>
                  <th className="px-2 py-2 font-medium">RefDes</th>
                  <th className="px-2 py-2 font-medium">Footprint</th>
                  <th className="px-2 py-2 font-medium text-center">DNP</th>
                  <th className="px-2 py-2 font-medium">Review Reason</th>
                  <th className="px-2 py-2 font-medium text-center">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.line_id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-2 py-1.5 text-slate-400 tabular-nums">{r.line_number}</td>
                    <td className="px-2 py-1.5"><StatusBadge status={r.quality_status} /></td>
                    <td className="px-2 py-1.5 font-medium tabular-nums">{r.original_mpn || "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-500">{r.cleaned_mpn || "—"}</td>
                    <td className="px-2 py-1.5">{r.manufacturer || "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-[220px] truncate">{r.original_description || "—"}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{r.qty_per_assembly ?? "—"}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{r.required_qty ?? "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-[140px] truncate">{r.reference_designators || "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600">{r.footprint || "—"}</td>
                    <td className="px-2 py-1.5 text-center">{r.is_dnp ? <Badge className="bg-slate-100 text-slate-600 border-slate-200">DNP</Badge> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-2 py-1.5 text-[11px] text-amber-700 max-w-[200px] truncate" title={r.review_reason ?? ""}>{r.review_reason || "—"}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditing(r)} title="עריכה" className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-brand">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {r.needs_review && r.quality_status !== "error" && (
                          <button onClick={() => markReviewed(r.line_id)} title="סמן כנבדק" className="h-7 w-7 rounded-md hover:bg-green-50 flex items-center justify-center text-slate-500 hover:text-risk-low">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={13} className="px-3 py-8 text-center text-slate-400">אין שורות התואמות לסינון.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <EditBomLineModal
          line={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            if (versionId) loadLines(versionId);
          }}
        />
      )}
    </>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}

export default function BomTablePage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <BomInner />
    </Suspense>
  );
}
