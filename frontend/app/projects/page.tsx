"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Upload, FolderOpen, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { Card, PageHeader, Kpi, StatusBadge, Badge } from "@/components/ui";

function QualityScore({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-400">—</span>;
  const cls =
    score >= 90
      ? "bg-green-50 text-risk-low border-green-200"
      : score >= 70
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-risk-critical border-red-200";
  return <Badge className={cls}>{score}</Badge>;
}
import { projects as mockProjects, type Project } from "@/lib/mock-data";
import { API_URL, apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

const STATUS_OPTIONS = ["Active", "In Review", "Quoting", "Archived"];
const NEW_CUSTOMER = "new";

type ApiProject = {
  id: number;
  customer_id: number;
  name: string;
  code: string;
  status: string;
  build_quantity: number;
  description: string | null;
  active_version_id: number | null;
  updated_at: string;
};

type ApiCustomer = { id: number; name: string; code: string | null };
type ApiVersion = { id: number; version_label: string; version_name: string | null };
type Metrics = {
  project_id: number;
  active_bom_version_name: string | null;
  bom_quality_score: number | null;
  bom_needs_review_count: number;
  latest_internal_cost: number | null;
  latest_internal_cost_currency: string | null;
  latest_pricing_snapshot_id: number | null;
  missing_price_count: number;
};

export default function ProjectsPage() {
  const { user } = useCurrentUser();
  const [apiRows, setApiRows] = useState<ApiProject[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [metrics, setMetrics] = useState<Record<number, Metrics>>({});
  const [live, setLive] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit / delete state.
  const [editRow, setEditRow] = useState<ApiProject | null>(null);
  const [fCustomer, setFCustomer] = useState<string>("");
  const [fNewName, setFNewName] = useState("");
  const [fNewCode, setFNewCode] = useState("");
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fStatus, setFStatus] = useState("Active");
  const [fQty, setFQty] = useState<number>(1);
  const [fDesc, setFDesc] = useState("");
  const [deleteRow, setDeleteRow] = useState<ApiProject | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    try {
      const [ps, cs, vs, ms] = await Promise.all([
        apiGet<ApiProject[]>("/api/projects"),
        apiGet<ApiCustomer[]>("/api/customers"),
        apiGet<ApiVersion[]>("/api/bom-versions"),
        apiGet<Metrics[]>("/api/projects/metrics").catch(() => [] as Metrics[]),
      ]);
      setApiRows(ps);
      setCustomers(cs);
      setVersions(vs);
      setMetrics(Object.fromEntries(ms.map((m) => [m.project_id, m])));
      setLive(true);
    } catch {
      setLive(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const customerName = (id: number) =>
    customers.find((c) => c.id === id)?.name ?? `Customer #${id}`;
  const versionName = (id: number | null) => {
    if (id == null) return "—";
    const v = versions.find((x) => x.id === id);
    return v ? v.version_name ?? v.version_label : "—";
  };

  async function createProject() {
    setCreating(true);
    try {
      const stamp = Date.now().toString().slice(-5);
      const customerId = customers[0]?.id ?? 1;
      await apiPost(
        "/api/projects",
        {
          customer_id: customerId,
          name: `פרויקט חדש ${stamp}`,
          code: `NEW-${stamp}`,
          build_quantity: 100,
          status: "Active",
        },
        user.id,
      );
      await load();
    } catch (e) {
      alert("יצירת פרויקט נכשלה — ודא שה-API פעיל. " + String(e));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(p: ApiProject) {
    setActionError(null);
    setEditRow(p);
    setFCustomer(String(p.customer_id));
    setFNewName("");
    setFNewCode("");
    setFName(p.name);
    setFCode(p.code);
    setFStatus(p.status);
    setFQty(p.build_quantity);
    setFDesc(p.description ?? "");
  }

  async function saveEdit() {
    if (!editRow) return;
    if (!fName.trim()) return setActionError("שם פרויקט נדרש");
    if (!fCode.trim()) return setActionError("קוד פרויקט נדרש");
    if (fCustomer === NEW_CUSTOMER && !fNewName.trim())
      return setActionError("שם לקוח חדש נדרש");

    setActionBusy(true);
    setActionError(null);
    try {
      const body: Record<string, unknown> = {
        name: fName,
        code: fCode,
        status: fStatus,
        build_quantity: fQty,
        description: fDesc || null,
      };
      if (fCustomer === NEW_CUSTOMER) {
        body.new_customer = { name: fNewName, code: fNewCode || null };
      } else {
        body.customer_id = Number(fCustomer);
      }
      await apiPatch(`/api/projects/${editRow.id}`, body, user.id);
      setEditRow(null);
      await load();
    } catch (e) {
      // Surface backend validation message (e.g. duplicate project code).
      setActionError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await apiDelete(`/api/projects/${deleteRow.id}`, user.id);
      setDeleteRow(null);
      await load();
    } catch (e) {
      setActionError(String(e));
    } finally {
      setActionBusy(false);
    }
  }

  // Fall back to mock data only when the API is unreachable.
  const mockRows: Project[] = mockProjects;
  const total = live ? apiRows.length : mockRows.length;
  const active = live
    ? apiRows.filter((p) => p.status === "Active" || p.status === "Quoting").length
    : mockRows.filter((p) => p.status === "Active" || p.status === "Quoting").length;
  const inReview = live
    ? apiRows.filter((p) => p.status === "In Review").length
    : mockRows.filter((p) => p.status === "In Review").length;
  const needsReviewTotal = Object.values(metrics).reduce(
    (s, m) => s + (m.bom_needs_review_count || 0),
    0,
  );
  const money = (v: number | null | undefined, ccy: string | null | undefined) =>
    v == null ? "—" : `${Math.round(v).toLocaleString()} ${ccy ?? ""}`.trim();

  return (
    <>
      <PageHeader
        title="פרויקטים"
        subtitle="ניהול פרויקטי לקוח, גרסאות BOM ועלויות רכש"
        actions={
          <>
            <span
              className={
                "text-[10px] px-2 py-1 rounded-full border " +
                (live
                  ? "bg-green-50 text-risk-low border-green-200"
                  : "bg-slate-100 text-slate-500 border-slate-200")
              }
              title={`API: ${API_URL}`}
            >
              {live ? "● מחובר ל-API" : "○ נתוני דמו"}
            </span>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> רענון
            </button>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50">
              <FolderOpen className="h-3.5 w-3.5" /> פתיחת תיקיית Drive
            </button>
            <Link
              href="/upload-bom"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50"
            >
              <Upload className="h-3.5 w-3.5" /> טעינת BOM
            </Link>
            <button
              onClick={createProject}
              disabled={creating}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" /> {creating ? "יוצר..." : "פרויקט חדש"}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Kpi label="סה״כ פרויקטים" value={total} />
        <Kpi label="פרויקטים פעילים" value={active} tone="good" />
        <Kpi label="BOMs בבדיקה" value={inReview} tone="warn" />
        <Kpi label="רכיבים לבדיקה" value={live ? needsReviewTotal : "—"} tone="bad" />
        <Kpi label="דוחות שהופקו החודש" value={18} hint="יוני 2026" />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-right">
              <th className="px-3 py-2 font-medium">לקוח</th>
              <th className="px-3 py-2 font-medium">שם פרויקט</th>
              <th className="px-3 py-2 font-medium">קוד פרויקט</th>
              <th className="px-3 py-2 font-medium">Active BOM</th>
              <th className="px-3 py-2 font-medium text-center">Quality</th>
              <th className="px-3 py-2 font-medium text-center">Needs Review</th>
              <th className="px-3 py-2 font-medium">Internal Cost</th>
              <th className="px-3 py-2 font-medium text-center">Missing Prices</th>
              <th className="px-3 py-2 font-medium">סטטוס</th>
              <th className="px-3 py-2 font-medium">עודכן</th>
              {live && <th className="px-3 py-2 font-medium text-center">פעולות</th>}
            </tr>
          </thead>
          <tbody>
            {live
              ? apiRows.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium">{customerName(p.customer_id)}</td>
                    <td className="px-3 py-2">
                      <Link href="/project" className="text-brand hover:underline font-medium">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{p.code}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {metrics[p.id]?.active_bom_version_name ?? versionName(p.active_version_id)}
                    </td>
                    <td className="px-3 py-2 text-center"><QualityScore score={metrics[p.id]?.bom_quality_score ?? null} /></td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {metrics[p.id] ? (
                        metrics[p.id].bom_needs_review_count > 0 ? (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200">{metrics[p.id].bom_needs_review_count}</Badge>
                        ) : <span className="text-slate-400">0</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {metrics[p.id]?.latest_pricing_snapshot_id ? (
                        <Link href={`/pricing-snapshots/${metrics[p.id].latest_pricing_snapshot_id}`} className="text-brand hover:underline">
                          {money(metrics[p.id].latest_internal_cost, metrics[p.id].latest_internal_cost_currency)}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {metrics[p.id] ? (
                        metrics[p.id].missing_price_count > 0 ? (
                          <Badge className="bg-red-50 text-risk-critical border-red-200">{metrics[p.id].missing_price_count}</Badge>
                        ) : <span className="text-slate-400">0</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2 text-slate-500 tabular-nums">
                      {p.updated_at?.slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          title="עריכה"
                          className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-brand"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setActionError(null);
                            setDeleteRow(p);
                          }}
                          title="מחיקה"
                          className="h-7 w-7 rounded-md hover:bg-red-50 flex items-center justify-center text-slate-500 hover:text-risk-critical"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              : mockRows.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{p.customer}</td>
                    <td className="px-3 py-2 text-brand font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{p.code}</td>
                    <td className="px-3 py-2 tabular-nums">{p.activeVersion}</td>
                    <td className="px-3 py-2 text-center text-slate-400">—</td>
                    <td className="px-3 py-2 text-center text-slate-400">—</td>
                    <td className="px-3 py-2 text-slate-400">—</td>
                    <td className="px-3 py-2 text-center text-slate-400">—</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{p.lastUpdated}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </Card>

      {/* Edit modal */}
      {editRow && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div dir="rtl" className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 text-[14px] font-semibold text-navy">
              עריכת פרויקט
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
              {actionError && (
                <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
                  {actionError}
                </div>
              )}
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">לקוח</label>
                <select
                  value={fCustomer}
                  onChange={(e) => setFCustomer(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.code ? ` (${c.code})` : ""}
                    </option>
                  ))}
                  <option value={NEW_CUSTOMER}>+ לקוח חדש</option>
                </select>
              </div>
              {fCustomer === NEW_CUSTOMER && (
                <div className="grid grid-cols-2 gap-2 rounded-md border border-dashed border-brand/30 bg-brand-soft/30 p-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">שם לקוח חדש *</label>
                    <input
                      value={fNewName}
                      onChange={(e) => setFNewName(e.target.value)}
                      className="w-full h-8 rounded-md border border-slate-200 px-2 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">קוד לקוח (אופציונלי)</label>
                    <input
                      value={fNewCode}
                      onChange={(e) => setFNewCode(e.target.value)}
                      className="w-full h-8 rounded-md border border-slate-200 px-2 text-[12px]"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">שם פרויקט *</label>
                <input
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] text-slate-600 mb-1">קוד פרויקט *</label>
                  <input
                    value={fCode}
                    onChange={(e) => setFCode(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-slate-600 mb-1">Build Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={fQty}
                    onChange={(e) => setFQty(Number(e.target.value))}
                    className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">סטטוס</label>
                <select
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
                >
                  {STATUS_OPTIONS.map((sv) => (
                    <option key={sv} value={sv}>
                      {sv}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">תיאור / הערות</label>
                <textarea
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12.5px]"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2">
              <button
                onClick={saveEdit}
                disabled={actionBusy}
                className="h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60"
              >
                {actionBusy ? "שומר..." : "שמירה"}
              </button>
              <button
                onClick={() => setEditRow(null)}
                disabled={actionBusy}
                className="h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] hover:bg-slate-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteRow && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div dir="rtl" className="w-full max-w-sm rounded-lg bg-white shadow-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 text-[14px] font-semibold text-navy">
              מחיקת פרויקט
            </div>
            <div className="p-4 space-y-2">
              {actionError && (
                <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
                  {actionError}
                </div>
              )}
              <p className="text-[12.5px] text-slate-700">
                האם אתה בטוח שברצונך למחוק את הפרויקט «{deleteRow.name}»?
              </p>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2">
              <button
                onClick={confirmDelete}
                disabled={actionBusy}
                className="h-9 px-4 rounded-md bg-risk-critical text-white text-[12.5px] font-medium hover:bg-risk-critical/90 disabled:opacity-60"
              >
                {actionBusy ? "מוחק..." : "מחיקה"}
              </button>
              <button
                onClick={() => setDeleteRow(null)}
                disabled={actionBusy}
                className="h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] hover:bg-slate-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
