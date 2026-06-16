"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Pencil, Lock, ArrowRight, Search } from "lucide-react";
import { Card, PageHeader, Kpi, Badge } from "@/components/ui";
import { apiGet, apiPatch } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type Line = {
  id: number;
  bom_line_id: number | null;
  mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  selected_source: string | null;
  required_qty: number | null;
  unit_cost: number | null;
  extended_cost: number | null;
  currency: string | null;
  match_confidence: number | null;
  pricing_status: string;
  notes: string | null;
};
type Snapshot = {
  id: number;
  snapshot_name: string;
  project_name: string | null;
  bom_version_name: string | null;
  source_type: string;
  supplier_quote_name: string | null;
  currency: string;
  status: string;
  created_at: string | null;
  total_internal_cost: number;
  priced_count: number;
  missing_price_count: number;
  needs_review_count: number;
  lines: Line[];
};

function PriceStatus({ status }: { status: string }) {
  if (status === "priced") return <Badge className="bg-green-50 text-risk-low border-green-200">Priced</Badge>;
  if (status === "needs_review") return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Needs Review</Badge>;
  return <Badge className="bg-red-50 text-risk-critical border-red-200">Missing Price</Badge>;
}

export default function PricingSnapshotDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { user } = useCurrentUser();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Line | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnap(await apiGet<Snapshot>(`/api/pricing-snapshots/${id}`));
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const lines = snap?.lines ?? [];
  const q = query.trim().toLowerCase();
  const shown = lines.filter((l) => {
    if (filter === "priced" && l.pricing_status !== "priced") return false;
    if (filter === "missing" && l.pricing_status !== "missing_price") return false;
    if (filter === "needs_review" && l.pricing_status !== "needs_review") return false;
    if (q) {
      const hay = [l.mpn, l.manufacturer, l.description].map((x) => (x ?? "").toLowerCase()).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const money = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString());

  return (
    <>
      <PageHeader
        title="Pricing Snapshot"
        subtitle={snap?.snapshot_name ?? ""}
        actions={
          <Link href="/china-quote" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50">
            <ArrowRight className="h-3.5 w-3.5" /> מחירון סין
          </Link>
        }
      />

      <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-[12px] px-3 py-2">
        <Lock className="h-4 w-4 shrink-0" /> מחיר פנימי בלבד — לא מיועד לדוח לקוח
      </div>

      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">{error}</div>}

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]"><Loader2 className="h-4 w-4 animate-spin" /> טוען...</div>
      ) : !snap ? (
        <Card className="p-10 text-center text-slate-400 text-[13px]">Pricing snapshot לא נמצא.</Card>
      ) : (
        <>
          <Card className="p-3 mb-3">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-1.5 text-[11.5px]">
              <Meta label="Snapshot" value={snap.snapshot_name} />
              <Meta label="פרויקט" value={snap.project_name} />
              <Meta label="BOM Version" value={snap.bom_version_name} />
              <Meta label="Source" value={snap.source_type} />
              <Meta label="Supplier Quote" value={snap.supplier_quote_name} />
              <Meta label="נוצר" value={snap.created_at?.slice(0, 10)} />
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <Kpi label="Total Internal Cost" value={`${money(snap.total_internal_cost)} ${snap.currency}`} tone="good" />
            <Kpi label="Priced" value={snap.priced_count} tone="good" />
            <Kpi label="Missing Price" value={snap.missing_price_count} tone="bad" />
            <Kpi label="Needs Review" value={snap.needs_review_count} tone="warn" />
            <Kpi label="Currency" value={snap.currency} />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {[["all", "הכל"], ["priced", "Priced"], ["missing", "Missing Price"], ["needs_review", "Needs Review"]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={"h-7 px-2.5 rounded-md text-[11.5px] border " + (filter === k ? "bg-brand text-brand-fg border-brand" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>{l}</button>
            ))}
            <div className="relative ms-auto">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש MPN / יצרן / תיאור" className="h-8 w-60 rounded-md border border-slate-200 ps-7 pe-2 text-[12px]" />
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-right">
                    <th className="px-2 py-2 font-medium">BOM Line</th>
                    <th className="px-2 py-2 font-medium">MPN</th>
                    <th className="px-2 py-2 font-medium">Manufacturer</th>
                    <th className="px-2 py-2 font-medium">Description</th>
                    <th className="px-2 py-2 font-medium text-center">Req Qty</th>
                    <th className="px-2 py-2 font-medium text-center">Unit Cost</th>
                    <th className="px-2 py-2 font-medium text-center">Extended</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium text-center">Conf</th>
                    <th className="px-2 py-2 font-medium">Source</th>
                    <th className="px-2 py-2 font-medium">Notes</th>
                    <th className="px-2 py-2 font-medium text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-2 py-1.5 text-slate-400 tabular-nums">{l.bom_line_id ?? "—"}</td>
                      <td className="px-2 py-1.5 font-medium tabular-nums">{l.mpn || "—"}</td>
                      <td className="px-2 py-1.5">{l.manufacturer || "—"}</td>
                      <td className="px-2 py-1.5 text-slate-600 max-w-[200px] truncate">{l.description || "—"}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{l.required_qty ?? "—"}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{l.unit_cost ?? "—"}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{money(l.extended_cost)}</td>
                      <td className="px-2 py-1.5"><PriceStatus status={l.pricing_status} /></td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{l.match_confidence ?? "—"}</td>
                      <td className="px-2 py-1.5 text-slate-600">{l.selected_source || "—"}</td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[140px] truncate" title={l.notes ?? ""}>{l.notes || "—"}</td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => setEditing(l)} title="עריכה" className="h-7 w-7 rounded-md hover:bg-slate-100 inline-flex items-center justify-center text-slate-500 hover:text-brand">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && <tr><td colSpan={12} className="px-3 py-8 text-center text-slate-400">אין שורות תמחור התואמות לסינון.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {editing && (
        <EditPricingLine
          line={editing}
          userId={user.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
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

function EditPricingLine({
  line,
  userId,
  onClose,
  onSaved,
}: {
  line: Line;
  userId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [unitCost, setUnitCost] = useState(line.unit_cost != null ? String(line.unit_cost) : "");
  const [currency, setCurrency] = useState(line.currency ?? "USD");
  const [source, setSource] = useState(line.selected_source ?? "");
  const [pstatus, setPstatus] = useState(line.pricing_status);
  const [notes, setNotes] = useState(line.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await apiPatch(
        `/api/pricing-lines/${line.id}`,
        {
          unit_cost: unitCost === "" ? null : Number(unitCost),
          currency,
          selected_source: source || null,
          pricing_status: pstatus,
          notes,
        },
        userId,
      );
      onSaved();
    } catch (e) {
      setErr(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  const inp = "w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white";
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div dir="rtl" className="w-full max-w-md rounded-lg bg-white shadow-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 text-[14px] font-semibold text-navy">עריכת שורת תמחור ({line.mpn || "—"})</div>
        <div className="p-4 space-y-3">
          {err && <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">{err}</div>}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-[11px] text-slate-600 mb-1">Unit Cost</label><input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={inp} /></div>
            <div><label className="block text-[11px] text-slate-600 mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inp}>{["USD", "CNY", "EUR", "ILS"].map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </div>
          </div>
          <div><label className="block text-[11px] text-slate-600 mb-1">Selected Source</label><input value={source} onChange={(e) => setSource(e.target.value)} placeholder="china_quote / manual" className={inp} /></div>
          <div><label className="block text-[11px] text-slate-600 mb-1">Status</label>
            <select value={pstatus} onChange={(e) => setPstatus(e.target.value)} className={inp}>
              {["priced", "missing_price", "needs_review"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="block text-[11px] text-slate-600 mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inp} /></div>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2">
          <button onClick={save} disabled={busy} className="h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60">{busy ? "שומר..." : "שמירה"}</button>
          <button onClick={onClose} disabled={busy} className="h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] hover:bg-slate-50">ביטול</button>
        </div>
      </div>
    </div>
  );
}
