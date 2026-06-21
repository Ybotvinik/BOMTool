"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { History, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { fmtPrice, type ConfigStatus } from "@/components/official-pricing/types";
import { apiGet, apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = { id: number; name: string };
type ApiVersion = { id: number; version_label: string; version_name: string | null; is_active: boolean };

type LookupOffer = {
  supplier: string;
  supplier_display: string;
  matched_mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  supplier_part_number: string | null;
  product_url: string | null;
  currency: string;
  unit_price: number | null;
  available_qty: number | null;
  match_status: string;
  match_reason: string | null;
  is_exact_match: boolean;
  project_name?: string | null;
  is_internal?: boolean;
  row_key?: string;
};

type LookupSummary = {
  id: number;
  search_mpn: string;
  required_qty: number;
  note: string | null;
  is_mock: boolean;
  created_at: string;
  last_checked_at: string;
  best_supplier_display: string | null;
  best_unit_price: number | null;
  priced_suppliers: number;
  additions_count: number;
  previous_lookup_count?: number;
  previously_searched?: boolean;
};

type MpnCrossReferences = {
  cleaned_mpn: string | null;
  is_partial_match?: boolean;
  previously_searched: boolean;
  previous_lookup_count: number;
  previous_lookups: {
    id: number;
    search_mpn: string;
    required_qty: number;
    created_at: string;
    last_checked_at: string;
    added_to_projects: {
      project_id: number;
      project_name?: string | null;
      bom_version_id: number;
      bom_line_id: number;
    }[];
  }[];
  bom_presence: {
    project_id: number;
    project_name: string;
    project_code?: string | null;
    bom_version_id: number;
    version_label: string;
    version_name?: string | null;
    bom_line_id: number;
    line_no: number | null;
    mpn: string | null;
    in_purchase_report: boolean;
    source: string | null;
    unit_price: number | null;
    status: string | null;
    solution_status: string | null;
  }[];
  china_quotes: {
    quote_id: number;
    quote_name: string | null;
    supplier_name: string;
    quote_source_type?: string;
    project_id: number;
    project_name: string;
    quoted_mpn: string | null;
    unit_price: number | null;
    currency: string | null;
    is_active: boolean;
    match_status: string | null;
    created_at?: string | null;
  }[];
  summary: {
    projects_seen: string[];
    projects_with_bom_line: string[];
    projects_in_purchase_report: string[];
    in_purchase_report_any: boolean;
    china_quote_hit: boolean;
    china_quote_count: number;
  };
};

type LookupDetail = {
  id: number;
  search_mpn: string;
  cleaned_mpn: string | null;
  manufacturer_hint: string | null;
  required_qty: number;
  note: string | null;
  is_mock: boolean;
  created_at: string;
  last_checked_at: string;
  offers: LookupOffer[];
  project_additions: {
    id: number;
    project_id: number;
    bom_version_id: number;
    bom_line_id: number;
    created_at: string;
  }[];
  cross_references?: MpnCrossReferences;
};

const SUPPLIER_STYLES: Record<string, string> = {
  "Digi-Key": "bg-blue-50 text-blue-700 border-blue-200",
  Mouser: "bg-violet-50 text-violet-700 border-violet-200",
  TI: "bg-red-50 text-red-700 border-red-200",
  Link: "bg-orange-50 text-orange-800 border-orange-200",
  "מזרח (Link)": "bg-orange-50 text-orange-800 border-orange-200",
};

function internalQuotesToOffers(
  quotes: MpnCrossReferences["china_quotes"],
): LookupOffer[] {
  return quotes.map((q) => {
    const isEast = q.quote_source_type === "east" || q.supplier_name?.toLowerCase().includes("link");
    const matched = ["exact_mpn", "matched", "designator_match"].includes(q.match_status || "");
    return {
      supplier: isEast ? "link" : "china_quote",
      supplier_display: isEast ? "מזרח (Link)" : "מחירון סין",
      matched_mpn: q.quoted_mpn,
      manufacturer: null,
      description: q.quote_name,
      supplier_part_number: null,
      product_url: null,
      currency: q.currency || "USD",
      unit_price: q.unit_price,
      available_qty: null,
      match_status: matched ? "matched" : "possible_match",
      match_reason: q.is_active ? `מחירון פעיל · ${q.project_name}` : `מחירון לא פעיל · ${q.project_name}`,
      is_exact_match: matched,
      project_name: q.project_name,
      is_internal: true,
      row_key: `internal-${q.quote_id}-${q.project_id}-${q.quoted_mpn}`,
    };
  });
}

function MatchBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    matched: "bg-green-50 text-green-700 border-green-200",
    possible_match: "bg-amber-50 text-amber-700 border-amber-200",
    not_found: "bg-slate-100 text-slate-600 border-slate-200",
    error: "bg-red-50 text-red-700 border-red-200",
  };
  return <Badge className={map[status] ?? map.not_found}>{status}</Badge>;
}

function fmtWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function MpnContextCard({
  context,
  loading,
}: {
  context: MpnCrossReferences | null;
  loading?: boolean;
}) {
  if (!context && !loading) return null;

  if (loading && !context) {
    return (
      <Card className="p-2.5 shrink-0 border-slate-200 bg-slate-50/60">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          מחפש הקשר MPN…
        </div>
      </Card>
    );
  }

  if (!context) return null;
  const { summary } = context;

  return (
    <Card className="p-2.5 shrink-0 border-slate-200 bg-slate-50/60">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[12px] font-semibold text-slate-800">הקשר MPN במערכת</div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 shrink-0" />}
      </div>
      {context.is_partial_match && (
        <p className="text-[10px] text-amber-700 mb-2">התאמה חלקית — מציג תוצאות לפי תחילית MPN</p>
      )}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {context.previously_searched ? (
          <Badge className="bg-amber-50 text-amber-800 border-amber-200">
            נבדק בעבר ({context.previous_lookup_count} פעמים)
          </Badge>
        ) : (
          <Badge className="bg-green-50 text-green-700 border-green-200">חיפוש ראשון במערכת</Badge>
        )}
        {summary.in_purchase_report_any ? (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200">מופיע בדוח רכש</Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-600 border-slate-200">לא בדוח רכש כרגע</Badge>
        )}
        {summary.china_quote_hit ? (
          <Badge className="bg-orange-50 text-orange-800 border-orange-200">
            מחירון סין/מזרח ({summary.china_quote_count})
          </Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-600 border-slate-200">ללא מחירון סין/מזרח</Badge>
        )}
      </div>

      {summary.projects_seen.length > 0 && (
        <div className="text-[10.5px] text-slate-700 mb-2">
          <span className="font-medium">פרויקטים קשורים: </span>
          {summary.projects_seen.join(" · ")}
        </div>
      )}

      {context.previous_lookups.length > 0 && (
        <div className="mb-2">
          <div className="text-[10.5px] font-medium text-slate-600 mb-1">בדיקות קודמות</div>
          <div className="space-y-1">
            {context.previous_lookups.slice(0, 5).map((row) => (
              <div key={row.id} className="text-[10px] text-slate-600 rounded border border-slate-200 bg-white px-2 py-1">
                #{row.id} · {fmtWhen(row.last_checked_at)}
                {row.added_to_projects.length > 0 && (
                  <span>
                    {" "}
                    · נוסף ל:{" "}
                    {row.added_to_projects
                      .map((p) => p.project_name || `פרויקט ${p.project_id}`)
                      .join(", ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {context.bom_presence.length > 0 && (
        <div className="mb-2">
          <div className="text-[10.5px] font-medium text-slate-600 mb-1">נוכחות ב-BOM / דוח רכש</div>
          <div className="overflow-auto max-h-28">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-start p-1">פרויקט</th>
                  <th className="text-start p-1">שורה</th>
                  <th className="text-start p-1">מקור</th>
                  <th className="text-start p-1">דוח רכש</th>
                </tr>
              </thead>
              <tbody>
                {context.bom_presence.map((row) => (
                  <tr key={row.bom_line_id} className="border-t border-slate-100">
                    <td className="p-1">{row.project_name}</td>
                    <td className="p-1">#{row.line_no ?? row.bom_line_id}</td>
                    <td className="p-1">{row.source ?? "—"}</td>
                    <td className="p-1">{row.in_purchase_report ? "כן" : "לא"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {context.china_quotes.length > 0 && (
        <div>
          <div className="text-[10.5px] font-medium text-slate-600 mb-1">מחירוני סין / מזרח (Link)</div>
          <div className="space-y-1 max-h-24 overflow-auto">
            {context.china_quotes.slice(0, 6).map((q) => (
              <div key={`${q.quote_id}-${q.quoted_mpn}`} className="text-[10px] text-slate-600 rounded border border-slate-200 bg-white px-2 py-1">
                {q.project_name} · {q.supplier_name}
                {q.quote_source_type === "east" ? " · Link" : ""} · {q.quoted_mpn}
                {q.unit_price != null ? ` · ${fmtPrice(q.unit_price, q.currency || "USD")}` : ""}
                {q.is_active ? " · פעיל" : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export function SingleComponentCheckPanel({ config }: { config: ConfigStatus | null }) {
  const { user } = useCurrentUser();
  const [mpn, setMpn] = useState("");
  const [requiredQty, setRequiredQty] = useState("1");
  const [manufacturerHint, setManufacturerHint] = useState("");
  const [note, setNote] = useState("");
  const [suppliers, setSuppliers] = useState({ digikey: true, mouser: true, ti: true });

  const [historyQ, setHistoryQ] = useState("");
  const [history, setHistory] = useState<LookupSummary[]>([]);
  const [active, setActive] = useState<LookupDetail | null>(null);
  const [mpnContext, setMpnContext] = useState<MpnCrossReferences | null>(null);
  const [mpnContextLoading, setMpnContextLoading] = useState(false);

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addProjectId, setAddProjectId] = useState<number | null>(null);
  const [addVersionId, setAddVersionId] = useState<number | null>(null);
  const [addQty, setAddQty] = useState("1");
  const [addRefdes, setAddRefdes] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [preferredSupplier, setPreferredSupplier] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadMpnContext = useCallback(
    async (search: string, excludeLookupId?: number) => {
      const trimmed = search.trim();
      if (trimmed.length < 3) {
        setMpnContext(null);
        setMpnContextLoading(false);
        return;
      }
      setMpnContextLoading(true);
      try {
        const qs = new URLSearchParams({ mpn: trimmed });
        if (excludeLookupId != null) qs.set("exclude_lookup_id", String(excludeLookupId));
        const data = await apiGet<MpnCrossReferences>(
          `/api/official-pricing/component-lookups/mpn-context?${qs.toString()}`,
        );
        setMpnContext(data);
      } catch {
        setMpnContext(null);
      } finally {
        setMpnContextLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const trimmed = mpn.trim();
    if (trimmed.length < 3) {
      setMpnContext(null);
      setMpnContextLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void loadMpnContext(trimmed, active?.id);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [mpn, active?.id, loadMpnContext]);

  useEffect(() => {
    if (active?.cross_references) {
      setMpnContext(active.cross_references);
    }
  }, [active]);

  const selectedSuppliers = useMemo(
    () => [
      ...(suppliers.digikey ? ["digikey"] : []),
      ...(suppliers.mouser ? ["mouser"] : []),
      ...(suppliers.ti ? ["ti"] : []),
    ],
    [suppliers],
  );

  const displayOffers = useMemo(() => {
    const search = mpn.trim();
    const activeMatches =
      !!active && active.search_mpn.trim().toUpperCase() === search.toUpperCase();
    const apiOffers = activeMatches ? (active.offers ?? []) : [];
    const internalQuotes =
      (activeMatches ? active.cross_references?.china_quotes : undefined) ??
      mpnContext?.china_quotes ??
      [];
    const internalOffers = internalQuotesToOffers(internalQuotes);
    return [...apiOffers, ...internalOffers];
  }, [active, mpn, mpnContext]);

  const loadHistory = useCallback(async () => {
    const q = historyQ.trim();
    const url = q
      ? `/api/official-pricing/component-lookups?q=${encodeURIComponent(q)}&limit=40`
      : "/api/official-pricing/component-lookups?limit=40";
    const data = await apiGet<{ items: LookupSummary[] }>(url);
    setHistory(data.items);
  }, [historyQ]);

  useEffect(() => {
    loadHistory().catch(() => setHistory([]));
    apiGet<ApiProject[]>("/api/projects").then((ps) => {
      setProjects(ps);
      if (ps.length) setAddProjectId(ps[0].id);
    });
  }, [loadHistory]);

  useEffect(() => {
    if (addProjectId == null) return;
    apiGet<ApiVersion[]>(`/api/bom-versions?project_id=${addProjectId}`).then((vs) => {
      setVersions(vs);
      const activeVersion = vs.find((v) => v.is_active) ?? vs[vs.length - 1];
      setAddVersionId(activeVersion ? activeVersion.id : null);
    });
  }, [addProjectId]);

  async function loadLookup(id: number) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const row = await apiGet<LookupDetail>(`/api/official-pricing/component-lookups/${id}`);
      setActive(row);
      setMpn(row.search_mpn);
      setRequiredQty(String(row.required_qty));
      setManufacturerHint(row.manufacturer_hint ?? "");
      setNote(row.note ?? "");
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function runLookup() {
    if (!mpn.trim()) {
      setError("יש להזין MPN");
      return;
    }
    if (!selectedSuppliers.length) {
      setError("יש לבחור לפחות ספק אחד");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const row = await apiPost<LookupDetail>(
        "/api/official-pricing/component-lookups",
        {
          mpn: mpn.trim(),
          required_qty: Number(requiredQty) || 1,
          manufacturer_hint: manufacturerHint.trim() || null,
          note: note.trim() || null,
          suppliers: selectedSuppliers,
        },
        user.id,
      );
      setActive(row);
      if (row.cross_references) setMpnContext(row.cross_references);
      await loadHistory();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function refreshActive() {
    if (!active) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const row = await apiPost<LookupDetail>(
        `/api/official-pricing/component-lookups/${active.id}/refresh`,
        { suppliers: selectedSuppliers },
        user.id,
      );
      setActive(row);
      if (row.cross_references) setMpnContext(row.cross_references);
      await loadHistory();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function addToProject() {
    if (!active || addProjectId == null || addVersionId == null) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiPost<{
        bom_line_id: number;
        line_no: number;
        mpn: string;
        project_id: number;
        bom_version_id: number;
      }>(
        `/api/official-pricing/component-lookups/${active.id}/add-to-project`,
        {
          project_id: addProjectId,
          bom_version_id: addVersionId,
          quantity_per_assembly: Number(addQty) || 1,
          reference_designators: addRefdes.trim() || null,
          notes: addNotes.trim() || null,
          preferred_supplier: preferredSupplier || null,
        },
        user.id,
      );
      setAddOpen(false);
      setSuccess(`נוסף לפרויקט כשורה #${res.line_no} (${res.mpn})`);
      await loadLookup(active.id);
      await loadHistory();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "h-8 w-full rounded-md border border-slate-200 px-2.5 text-[12px] bg-white";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,300px)_1fr] gap-2 min-h-0 flex-1 overflow-hidden">
      <Card className="p-2 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center gap-1.5 mb-2 shrink-0">
          <History className="w-4 h-4 text-slate-500" />
          <span className="text-[12px] font-semibold text-slate-800">לוג בדיקות</span>
        </div>
        <div className="relative mb-2 shrink-0">
          <Search className="w-3.5 h-3.5 absolute start-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputCls} ps-7`}
            placeholder="חיפוש MPN..."
            value={historyQ}
            onChange={(e) => setHistoryQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadHistory()}
          />
        </div>
        <button
          type="button"
          onClick={() => loadHistory()}
          className="mb-2 h-7 rounded-md border border-slate-200 text-[11px] hover:bg-slate-50 shrink-0"
        >
          חפש בלוג
        </button>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {history.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => loadLookup(row.id)}
              className={`w-full text-start rounded-md border px-2 py-1.5 transition-colors ${
                active?.id === row.id
                  ? "border-brand bg-brand/5"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="text-[11px] font-semibold text-slate-800 truncate">{row.search_mpn}</div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {row.previously_searched && (
                  <span className="text-[9px] px-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    חיפוש חוזר
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                כמות {row.required_qty} · {fmtWhen(row.last_checked_at)}
              </div>
              <div className="text-[10px] text-slate-600 mt-0.5">
                {row.best_supplier_display && row.best_unit_price != null
                  ? `${row.best_supplier_display} ${fmtPrice(row.best_unit_price)}`
                  : "ללא מחיר"}
                {row.additions_count > 0 ? ` · נוסף ל-${row.additions_count} פרויקטים` : ""}
              </div>
            </button>
          ))}
          {!history.length && (
            <div className="text-[11px] text-slate-500 text-center py-6">אין בדיקות שמורות עדיין</div>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
        {config?.mock_mode && (
          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 shrink-0">
            מצב דמו — המחירים אינם אמיתיים
          </div>
        )}
        {error && (
          <div className="text-[11px] text-red-800 bg-red-50 border border-red-200 rounded-md px-2 py-1 shrink-0">
            {error}
          </div>
        )}
        {success && (
          <div className="text-[11px] text-green-800 bg-green-50 border border-green-200 rounded-md px-2 py-1 shrink-0">
            {success}
          </div>
        )}

        <Card className="p-2.5 shrink-0">
          <div className="text-[12px] font-semibold text-slate-800 mb-2">בדיקת רכיב בודד</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">MPN *</label>
              <input
                className={inputCls}
                value={mpn}
                onChange={(e) => setMpn(e.target.value)}
                placeholder="LM358 / TMK063…"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">כמות נדרשת</label>
              <input
                className={inputCls}
                type="number"
                min={1}
                value={requiredQty}
                onChange={(e) => setRequiredQty(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">יצרן (אופציונלי)</label>
              <input
                className={inputCls}
                value={manufacturerHint}
                onChange={(e) => setManufacturerHint(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">הערה</label>
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <label className="inline-flex items-center gap-1 text-[10.5px]">
              <input
                type="checkbox"
                checked={suppliers.digikey}
                onChange={(e) => setSuppliers((s) => ({ ...s, digikey: e.target.checked }))}
              />
              Digi-Key
            </label>
            <label className="inline-flex items-center gap-1 text-[10.5px]">
              <input
                type="checkbox"
                checked={suppliers.mouser}
                onChange={(e) => setSuppliers((s) => ({ ...s, mouser: e.target.checked }))}
              />
              Mouser
            </label>
            <label className="inline-flex items-center gap-1 text-[10.5px]">
              <input
                type="checkbox"
                checked={suppliers.ti}
                onChange={(e) => setSuppliers((s) => ({ ...s, ti: e.target.checked }))}
              />
              TI
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={runLookup}
              className="inline-flex items-center gap-1 h-7 px-3 rounded-md bg-brand text-white text-[11px] disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              בדוק מחירים
            </button>
            {active && (
              <button
                type="button"
                disabled={busy}
                onClick={refreshActive}
                className="inline-flex items-center gap-1 h-7 px-3 rounded-md border border-slate-200 text-[11px] hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                רענן מ-API
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            בדיקות נשמרות בלוג — לחיצה על רשומה בצד שמאל טוענת תוצאות שמורות ללא קריאת API חדשה.
          </p>
        </Card>

        <MpnContextCard context={mpnContext} loading={mpnContextLoading} />

        <Card className="p-2 flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
            <div className="text-[12px] font-semibold text-slate-800">
              {active
                ? `תוצאות #${active.id} · ${active.search_mpn}`
                : displayOffers.length
                  ? `תוצאות · ${mpn.trim()}`
                  : "תוצאות"}
            </div>
            {active && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setAddQty(String(active.required_qty));
                  setPreferredSupplier(active.offers.find((o) => o.unit_price != null)?.supplier ?? "");
                  setAddOpen(true);
                }}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-brand/10 text-brand text-[11px] hover:bg-brand/15 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                הוסף לפרויקט
              </button>
            )}
          </div>

          {!displayOffers.length ? (
            <div className="text-[11px] text-slate-500 text-center py-10">
              הזן MPN (לפחות 3 תווים) ולחץ &quot;בדוק מחירים&quot;, או בחר בדיקה מהלוג
            </div>
          ) : (
            <div className="overflow-auto min-h-0 flex-1">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-start p-1.5 font-medium">ספק</th>
                    <th className="text-start p-1.5 font-medium">פרויקט</th>
                    <th className="text-start p-1.5 font-medium">MPN מותאם</th>
                    <th className="text-start p-1.5 font-medium">מחיר</th>
                    <th className="text-start p-1.5 font-medium">מלאי</th>
                    <th className="text-start p-1.5 font-medium">סטטוס</th>
                    <th className="text-start p-1.5 font-medium">PN ספק</th>
                  </tr>
                </thead>
                <tbody>
                  {displayOffers.map((offer) => (
                    <tr
                      key={offer.row_key ?? offer.supplier}
                      className={`border-t border-slate-100 ${offer.is_internal ? "bg-orange-50/30" : ""}`}
                    >
                      <td className="p-1.5">
                        <Badge
                          className={
                            SUPPLIER_STYLES[offer.supplier_display] ??
                            (offer.is_internal
                              ? "bg-orange-50 text-orange-800 border-orange-200"
                              : "")
                          }
                        >
                          {offer.supplier_display}
                        </Badge>
                      </td>
                      <td className="p-1.5 text-[10px] text-slate-600">{offer.project_name ?? "—"}</td>
                      <td className="p-1.5 font-mono text-[10px]">{offer.matched_mpn ?? "—"}</td>
                      <td className="p-1.5 tabular-nums">{fmtPrice(offer.unit_price, offer.currency)}</td>
                      <td className="p-1.5 tabular-nums">{offer.available_qty ?? "—"}</td>
                      <td className="p-1.5">
                        <MatchBadge status={offer.match_status} />
                        {offer.match_reason && offer.is_internal && (
                          <div className="text-[9px] text-slate-500 mt-0.5">{offer.match_reason}</div>
                        )}
                      </td>
                      <td className="p-1.5">
                        {offer.product_url ? (
                          <a
                            href={offer.product_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:underline font-mono text-[10px]"
                          >
                            {offer.supplier_part_number ?? "קישור"}
                          </a>
                        ) : (
                          offer.supplier_part_number ?? "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {active && active.project_additions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 shrink-0">
              <div className="text-[10px] font-medium text-slate-600 mb-1">נוסף לפרויקטים</div>
              <div className="flex flex-wrap gap-1">
                {active.project_additions.map((add) => (
                  <Link
                    key={add.id}
                    href={`/bom?project_id=${add.project_id}&version_id=${add.bom_version_id}`}
                    className="text-[10px] px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50"
                  >
                    פרויקט #{add.project_id} · שורה #{add.bom_line_id}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {addOpen && active && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-4 space-y-2">
            <div className="text-[13px] font-semibold">הוסף {active.search_mpn} לפרויקט</div>
            <div>
              <label className="text-[10px] text-slate-500">פרויקט</label>
              <select
                className={inputCls}
                value={addProjectId ?? ""}
                onChange={(e) => setAddProjectId(Number(e.target.value))}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500">גרסת BOM</label>
              <select
                className={inputCls}
                value={addVersionId ?? ""}
                onChange={(e) => setAddVersionId(Number(e.target.value))}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_name || v.version_label}
                    {v.is_active ? " ★" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500">כמות ליחידה</label>
              <input
                className={inputCls}
                type="number"
                min={0.0001}
                step="any"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">ספק מועדף (אופציונלי)</label>
              <select
                className={inputCls}
                value={preferredSupplier}
                onChange={(e) => setPreferredSupplier(e.target.value)}
              >
                <option value="">אוטומטי — הזול ביותר</option>
                {active.offers.map((o) => (
                  <option key={o.supplier} value={o.supplier}>
                    {o.supplier_display}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Reference designators</label>
              <input className={inputCls} value={addRefdes} onChange={(e) => setAddRefdes(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">הערות</label>
              <input className={inputCls} value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="h-8 px-3 rounded-md border text-[12px]"
                onClick={() => setAddOpen(false)}
                disabled={busy}
              >
                ביטול
              </button>
              <button
                type="button"
                className="h-8 px-3 rounded-md bg-brand text-white text-[12px] disabled:opacity-50"
                onClick={addToProject}
                disabled={busy}
              >
                {busy ? "מוסיף…" : "הוסף"}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
