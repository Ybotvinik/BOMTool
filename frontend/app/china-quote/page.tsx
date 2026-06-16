"use client";

import { useEffect, useState } from "react";
import { UploadCloud, Loader2, Database, DollarSign, RefreshCw, Lock, Table2 } from "lucide-react";
import { Card, PageHeader, Kpi, Badge } from "@/components/ui";
import { apiGet, apiPost, apiPatch, apiChinaPreview } from "@/lib/api";
import Link from "next/link";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = { id: number; name: string };
type ApiVersion = { id: number; version_label: string; version_name: string | null; is_active: boolean };
type Quote = { id: number; quote_name: string | null; supplier_name: string; currency: string; created_at: string };
type Preview = {
  file_id: string;
  file_name: string;
  sheet_name: string;
  columns: string[];
  rows: string[][];
  total_rows: number;
  header_row_index: number | null;
  suggested_mapping: Record<string, string | null>;
  warning: string | null;
};
type ImportResult = {
  supplier_quote_id: number;
  lines_imported: number;
  matched_count: number;
  possible_match_count: number;
  not_matched_count: number;
  currency: string;
  quote_name: string;
  total_rows_scanned: number;
  lines_skipped: number;
  missing_mpn_count: number;
  missing_price_count: number;
  skipped_rows_sample: string[];
};
type BomLineLite = { id: number; line_no: number | null; mpn: string | null };
type QuoteLine = {
  id: number;
  quoted_mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  unit_price: number | null;
  currency: string | null;
  moq: number | null;
  available_qty: number | null;
  lead_time: string | null;
  matched_bom_line: { mpn: string | null } | null;
  match_status: string;
  match_confidence: number;
  match_reason: string | null;
};
type PricingResult = {
  pricing_snapshot_id: number;
  priced_count: number;
  missing_price_count: number;
  needs_review_count: number;
  total_internal_cost: number;
  currency: string;
};

const MAP_FIELDS: [string, string][] = [
  ["quoted_mpn", "MPN *"],
  ["manufacturer", "Manufacturer"],
  ["description", "Description"],
  ["supplier_part_number", "Supplier Part Number"],
  ["unit_price", "Unit Price *"],
  ["currency", "Currency"],
  ["moq", "MOQ"],
  ["available_qty", "Available Qty"],
  ["lead_time", "Lead Time"],
  ["notes", "Notes"],
];
const NONE = "__none__";

function MatchBadge({ status }: { status: string }) {
  if (status === "matched") return <Badge className="bg-green-50 text-risk-low border-green-200">Matched</Badge>;
  if (status === "possible_match") return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Possible</Badge>;
  return <Badge className="bg-slate-100 text-slate-500 border-slate-200">Not matched</Badge>;
}

export default function ChinaQuotePage() {
  const { user } = useCurrentUser();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteId, setQuoteId] = useState<number | null>(null);

  const [quoteName, setQuoteName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [lineFilter, setLineFilter] = useState("all");
  const [pricing, setPricing] = useState<PricingResult | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchLine, setMatchLine] = useState<QuoteLine | null>(null);
  const [bomLines, setBomLines] = useState<BomLineLite[]>([]);

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects").then((ps) => {
      setProjects(ps);
      if (ps.length) setProjectId(ps[0].id);
    });
  }, []);

  useEffect(() => {
    if (projectId == null) return;
    apiGet<ApiVersion[]>(`/api/bom-versions?project_id=${projectId}`).then((vs) => {
      setVersions(vs);
      const active = vs.find((v) => v.is_active) ?? vs[vs.length - 1];
      setVersionId(active ? active.id : null);
    });
    apiGet<Quote[]>(`/api/projects/${projectId}/china-quotes`).then(setQuotes).catch(() => setQuotes([]));
  }, [projectId]);

  async function loadQuoteLines(id: number) {
    const data = await apiGet<QuoteLine[]>(`/api/china-quotes/${id}/lines`);
    setLines(data);
  }

  function selectExistingQuote(id: number) {
    setQuoteId(id);
    setResult(null);
    setPreview(null);
    setPricing(null);
    if (id) loadQuoteLines(id);
    else setLines([]);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const pv = await apiChinaPreview<Preview>({
        file,
        projectId: projectId ?? undefined,
        bomVersionId: versionId ?? undefined,
        userId: user.id,
      });
      setPreview(pv);
      setMapping(pv.suggested_mapping);
      if (!quoteName) setQuoteName(pv.file_name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!preview || projectId == null) return;
    if (!mapping.quoted_mpn || !mapping.unit_price) {
      setError("חובה למפות לפחות MPN ומחיר יחידה (Unit Price)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<ImportResult>(
        "/api/china-quotes/import",
        {
          project_id: projectId,
          bom_version_id: versionId,
          file_id: preview.file_id,
          quote_name: quoteName || preview.file_name,
          supplier_name: supplierName || "China Supplier",
          currency,
          selected_sheet: preview.sheet_name,
          header_row_index: preview.header_row_index,
          column_mapping: mapping,
        },
        user.id,
      );
      setResult(res);
      setQuoteId(res.supplier_quote_id);
      setPreview(null);
      await loadQuoteLines(res.supplier_quote_id);
      if (projectId) apiGet<Quote[]>(`/api/projects/${projectId}/china-quotes`).then(setQuotes);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function rematch() {
    if (quoteId == null) return;
    setBusy(true);
    try {
      await apiPost(`/api/china-quotes/${quoteId}/match`, {}, user.id);
      await loadQuoteLines(quoteId);
    } finally {
      setBusy(false);
    }
  }

  async function openMatch(line: QuoteLine) {
    setMatchLine(line);
    if (versionId != null && bomLines.length === 0) {
      try {
        const bls = await apiGet<BomLineLite[]>(`/api/bom-versions/${versionId}/lines`);
        setBomLines(bls);
      } catch {
        setBomLines([]);
      }
    }
  }

  async function saveMatch(bomLineId: number | null, matchStatus: string) {
    if (matchLine == null) return;
    setBusy(true);
    try {
      await apiPatch(
        `/api/china-quotes/lines/${matchLine.id}/match`,
        { bom_line_id: bomLineId, match_status: matchStatus, match_reason: "Manual match" },
        user.id,
      );
      setMatchLine(null);
      if (quoteId != null) await loadQuoteLines(quoteId);
    } finally {
      setBusy(false);
    }
  }

  async function createPricing() {
    if (quoteId == null || versionId == null || projectId == null) {
      setError("יש לבחור גרסת BOM והצעת מחיר לפני יצירת Pricing Snapshot");
      return;
    }
    const qn = quotes.find((q) => q.id === quoteId)?.quote_name ?? result?.quote_name ?? "";
    const name = window.prompt("שם ל-Pricing Snapshot:", `China Quote - ${qn}`);
    if (name === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<PricingResult>(
        "/api/pricing-snapshots/from-china-quote",
        { project_id: projectId, bom_version_id: versionId, supplier_quote_id: quoteId, snapshot_name: name },
        user.id,
      );
      setPricing(res);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  const shownLines = lines.filter((l) => {
    if (lineFilter === "matched") return l.match_status === "matched";
    if (lineFilter === "possible") return l.match_status === "possible_match";
    if (lineFilter === "not") return l.match_status === "not_matched";
    return true;
  });

  return (
    <>
      <PageHeader title="מחירון סין" subtitle="העלאת הצעת מחיר מספק סיני, התאמה ל-BOM ותמחור עלות פנימית" />

      <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-[12px] px-3 py-2">
        <Lock className="h-4 w-4 shrink-0" />
        מידע זה פנימי בלבד ואינו מיועד לדוח לקוח
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">{error}</div>
      )}

      {/* Controls */}
      <Card className="p-3 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">פרויקט</label>
            <select value={projectId ?? ""} onChange={(e) => setProjectId(Number(e.target.value))} className={sel}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">גרסת BOM (להתאמה)</label>
            <select value={versionId ?? ""} onChange={(e) => setVersionId(Number(e.target.value))} className={sel}>
              {versions.length === 0 && <option value="">אין גרסאות</option>}
              {versions.map((v) => <option key={v.id} value={v.id}>{v.version_name ?? v.version_label} (#{v.id}){v.is_active ? " ★" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">הצעות מחיר קיימות</label>
            <select value={quoteId ?? ""} onChange={(e) => selectExistingQuote(Number(e.target.value))} className={sel}>
              <option value="">— חדש —</option>
              {quotes.map((q) => <option key={q.id} value={q.id}>{q.quote_name} · {q.supplier_name} (#{q.id})</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Upload */}
      {!result && quoteId == null && (
        <Card className="p-4 mb-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-[12px] text-slate-600 mb-1">שם הצעת מחיר</label>
              <input value={quoteName} onChange={(e) => setQuoteName(e.target.value)} className={sel} placeholder="Shenzhen Q1" />
            </div>
            <div>
              <label className="block text-[12px] text-slate-600 mb-1">שם ספק</label>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={sel} placeholder="Shenzhen Components" />
            </div>
            <div>
              <label className="block text-[12px] text-slate-600 mb-1">מטבע</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={sel}>
                {["USD", "CNY", "EUR", "ILS"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-8 cursor-pointer hover:border-brand/50 hover:bg-brand-soft/40">
            {busy ? <Loader2 className="h-8 w-8 text-brand animate-spin" /> : <UploadCloud className="h-8 w-8 text-brand" />}
            <div className="text-[12.5px] font-medium text-slate-700">בחר קובץ הצעת מחיר (Excel/CSV)</div>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </Card>
      )}

      {/* Preview + mapping */}
      {preview && !result && (
        <Card className="p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Table2 className="h-4 w-4 text-brand" />
            <h2 className="text-[13.5px] font-semibold">תצוגה מקדימה ({preview.rows.length} מתוך {preview.total_rows})</h2>
          </div>
          <div className="overflow-auto border border-slate-200 rounded-md mb-4 max-h-52">
            <table className="w-full text-[11.5px]">
              <thead className="bg-brand-soft sticky top-0">
                <tr className="text-right text-brand">
                  {preview.columns.map((c, i) => <th key={i} className="px-2 py-1.5 font-semibold whitespace-nowrap">{c || "—"}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {preview.columns.map((_, j) => <td key={j} className="px-2 py-1 whitespace-nowrap text-slate-700">{r[j] ?? ""}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 mb-2"><Database className="h-4 w-4 text-brand" /><h2 className="text-[13.5px] font-semibold">מיפוי עמודות</h2></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
            {MAP_FIELDS.map(([key, label]) => (
              <div key={key}>
                <label className="block text-[11px] text-slate-600 mb-1">{label}</label>
                <select
                  value={mapping[key] ?? NONE}
                  onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value === NONE ? null : e.target.value }))}
                  className="w-full h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white"
                >
                  <option value={NONE}>— ללא —</option>
                  {preview.columns.filter(Boolean).map((c, i) => <option key={i} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button onClick={doImport} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} ייבוא מחירון סין
          </button>
        </Card>
      )}

      {/* Import summary cards */}
      {result && (
        <>
          {result.lines_imported === 0 && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
              לא יובאו שורות. נסרקו {result.total_rows_scanned} שורות, {result.lines_skipped} דולגו. ודא מיפוי עמודות ושורת כותרות נכונה.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
            <Kpi label="Lines Imported" value={result.lines_imported} />
            <Kpi label="Matched" value={result.matched_count} tone="good" />
            <Kpi label="Possible Match" value={result.possible_match_count} tone="warn" />
            <Kpi label="Not Matched" value={result.not_matched_count} tone="bad" />
            <Kpi label="Currency" value={result.currency} />
          </div>
          <div className="mb-3 text-[11.5px] text-slate-500">
            סך נסרקו {result.total_rows_scanned} · דולגו {result.lines_skipped} · חסר MPN {result.missing_mpn_count} · חסר מחיר {result.missing_price_count}
          </div>
        </>
      )}

      {/* Pricing result */}
      {pricing && (
        <Card className="p-3 mb-3 border-brand/30">
          <div className="text-[13px] font-semibold text-navy mb-2">Pricing Snapshot נוצר (#{pricing.pricing_snapshot_id})</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <Kpi label="Total Internal Cost" value={`${pricing.total_internal_cost.toLocaleString()} ${pricing.currency}`} tone="good" />
            <Kpi label="Priced" value={pricing.priced_count} tone="good" />
            <Kpi label="Missing Prices" value={pricing.missing_price_count} tone="bad" />
            <Kpi label="Needs Review" value={pricing.needs_review_count} tone="warn" />
            <Kpi label="Currency" value={pricing.currency} />
          </div>
          <Link
            href={`/pricing-snapshots/${pricing.pricing_snapshot_id}`}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90"
          >
            <Table2 className="h-4 w-4" /> פתח Pricing Snapshot
          </Link>
        </Card>
      )}

      {/* Quote lines table */}
      {quoteId != null && lines.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-2.5 border-b border-slate-100">
            {[["all", "הכל"], ["matched", "Matched"], ["possible", "Possible"], ["not", "Not matched"]].map(([k, l]) => (
              <button key={k} onClick={() => setLineFilter(k)} className={"h-7 px-2.5 rounded-md text-[11.5px] border " + (lineFilter === k ? "bg-brand text-brand-fg border-brand" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>{l}</button>
            ))}
            <div className="ms-auto flex gap-2">
              <button onClick={rematch} disabled={busy} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50 disabled:opacity-60">
                <RefreshCw className="h-3.5 w-3.5" /> התאמה מחדש
              </button>
              <button onClick={createPricing} disabled={busy} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90 disabled:opacity-60">
                <DollarSign className="h-3.5 w-3.5" /> צור Pricing Snapshot ממחירון סין
              </button>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-right">
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Quoted MPN</th>
                  <th className="px-2 py-2 font-medium">Manufacturer</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium text-center">Unit Price</th>
                  <th className="px-2 py-2 font-medium text-center">MOQ</th>
                  <th className="px-2 py-2 font-medium text-center">Avail Qty</th>
                  <th className="px-2 py-2 font-medium">Lead Time</th>
                  <th className="px-2 py-2 font-medium">Matched BOM MPN</th>
                  <th className="px-2 py-2 font-medium text-center">Confidence</th>
                  <th className="px-2 py-2 font-medium">Reason</th>
                  <th className="px-2 py-2 font-medium text-center">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {shownLines.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-2 py-1.5"><MatchBadge status={l.match_status} /></td>
                    <td className="px-2 py-1.5 font-medium tabular-nums">{l.quoted_mpn || "—"}</td>
                    <td className="px-2 py-1.5">{l.manufacturer || "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-[200px] truncate">{l.description || "—"}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{l.unit_price != null ? `${l.unit_price} ${l.currency ?? ""}` : "—"}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{l.moq ?? "—"}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{l.available_qty ?? "—"}</td>
                    <td className="px-2 py-1.5">{l.lead_time || "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{l.matched_bom_line?.mpn || "—"}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{l.match_confidence}</td>
                    <td className="px-2 py-1.5 text-[11px] text-slate-500 max-w-[180px] truncate" title={l.match_reason ?? ""}>{l.match_reason || "—"}</td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => openMatch(l)} className="h-7 px-2 rounded-md hover:bg-slate-100 text-[11px] text-brand">עדכן התאמה</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {matchLine && (
        <MatchModal
          line={matchLine}
          bomLines={bomLines}
          busy={busy}
          onClose={() => setMatchLine(null)}
          onSave={saveMatch}
        />
      )}
    </>
  );
}

function MatchModal({
  line,
  bomLines,
  busy,
  onClose,
  onSave,
}: {
  line: QuoteLine;
  bomLines: BomLineLite[];
  busy: boolean;
  onClose: () => void;
  onSave: (bomLineId: number | null, status: string) => void;
}) {
  const [bomLineId, setBomLineId] = useState<string>(String(line.matched_bom_line?.mpn ? "" : ""));
  const [matchStatus, setMatchStatus] = useState("matched");
  const [search, setSearch] = useState("");
  const filtered = bomLines.filter((b) =>
    !search ? true : (b.mpn ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div dir="rtl" className="w-full max-w-md rounded-lg bg-white shadow-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 text-[14px] font-semibold text-navy">עדכון התאמה ({line.quoted_mpn || "—"})</div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[11px] text-slate-600 mb-1">חיפוש שורת BOM</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="MPN" className={sel} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-600 mb-1">שורת BOM</label>
            <select value={bomLineId} onChange={(e) => setBomLineId(e.target.value)} className={sel}>
              <option value="">— ללא (Not matched) —</option>
              {filtered.map((b) => (
                <option key={b.id} value={b.id}>#{b.line_no} · {b.mpn || "—"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-600 mb-1">סטטוס התאמה</label>
            <select value={matchStatus} onChange={(e) => setMatchStatus(e.target.value)} className={sel}>
              {["matched", "possible_match", "not_matched"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2">
          <button
            onClick={() => onSave(bomLineId === "" ? null : Number(bomLineId), bomLineId === "" ? "not_matched" : matchStatus)}
            disabled={busy}
            className="h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? "שומר..." : "שמירה"}
          </button>
          <button onClick={onClose} disabled={busy} className="h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] hover:bg-slate-50">ביטול</button>
        </div>
      </div>
    </div>
  );
}

const sel = "w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white";
