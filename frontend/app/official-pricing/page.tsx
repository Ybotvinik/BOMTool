"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Globe, AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = { id: number; name: string };
type ApiVersion = {
  id: number;
  version_label: string;
  version_name: string | null;
  is_active: boolean;
};

type SupplierCell = {
  unit_price: number | null;
  available_qty: number | null;
  match_status: string | null;
  is_exact_match: boolean | null;
  supplier_part_number: string | null;
  lead_time: string | null;
  currency: string | null;
};

type ResultLine = {
  bom_line_id: number;
  line_no: number | null;
  mpn: string | null;
  cleaned_mpn: string | null;
  manufacturer: string | null;
  required_qty: number | null;
  dnp: boolean;
  digikey: SupplierCell | null;
  mouser: SupplierCell | null;
  selected_official_source: string | null;
};

type ConfigStatus = {
  digikey: { configured: boolean; credentials_missing: boolean; env: string; mode: string };
  mouser: { configured: boolean; credentials_missing: boolean; mode: string };
  mock_mode: boolean;
  mock_allow_export: boolean;
};

function supplierModeLabel(mode: string): string {
  if (mode === "real_api") return "Real API configured";
  if (mode === "mock") return "Mock mode active";
  return "Credentials missing";
}

type ResultsResponse = {
  project_id: number;
  bom_version_id: number;
  config: ConfigStatus;
  lines: ResultLine[];
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

function fmtPrice(v: number | null | undefined, currency = "USD") {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge className="bg-slate-100 text-slate-500">—</Badge>;
  if (status === "matched")
    return <Badge className="bg-green-50 text-green-700 border-green-200">Matched</Badge>;
  if (status === "possible_match")
    return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Possible</Badge>;
  if (status === "error")
    return <Badge className="bg-red-50 text-red-700 border-red-200">Error</Badge>;
  return <Badge className="bg-slate-100 text-slate-500">{status}</Badge>;
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
  const { user } = useCurrentUser();

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [versionId, setVersionId] = useState<number | null>(null);

  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [lines, setLines] = useState<ResultLine[]>([]);
  const [fetchResult, setFetchResult] = useState<FetchResponse | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [snapshotName, setSnapshotName] = useState("Official API Pricing");

  const [suppliers, setSuppliers] = useState({ digikey: true, mouser: true });
  const [mode, setMode] = useState<"all" | "missing_only">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sel = "w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white";

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects").then((ps) => {
      setProjects(ps);
      if (urlProjectId) {
        const match = ps.find((p) => String(p.id) === urlProjectId);
        if (match) setProjectId(match.id);
      } else if (ps.length) {
        setProjectId(ps[0].id);
      }
    });
    apiGet<ConfigStatus>("/api/official-pricing/status")
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [urlProjectId]);

  useEffect(() => {
    if (projectId == null) return;
    apiGet<ApiVersion[]>(`/api/bom-versions?project_id=${projectId}`).then((vs) => {
      setVersions(vs);
      const active = vs.find((v) => v.is_active) ?? vs[vs.length - 1];
      setVersionId(active ? active.id : null);
    });
  }, [projectId]);

  const loadResults = useCallback(async () => {
    if (projectId == null || versionId == null) return;
    const data = await apiGet<ResultsResponse>(
      `/api/official-pricing/results?project_id=${projectId}&bom_version_id=${versionId}`,
    );
    setConfig(data.config);
    setLines(data.lines);
  }, [projectId, versionId]);

  useEffect(() => {
    loadResults().catch(() => setLines([]));
  }, [loadResults]);

  const credentialsMissing =
    config &&
    !config.mock_mode &&
    (config.digikey.credentials_missing || config.mouser.credentials_missing);

  async function doFetch() {
    if (projectId == null || versionId == null) return;
    const selected = [
      ...(suppliers.digikey ? ["digikey"] : []),
      ...(suppliers.mouser ? ["mouser"] : []),
    ];
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
        {
          project_id: projectId,
          bom_version_id: versionId,
          suppliers: selected,
          mode,
        },
        user.id,
      );
      setFetchResult(res);
      await loadResults();
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
          supplier_priority: [
            ...(suppliers.digikey ? ["digikey"] : []),
            ...(suppliers.mouser ? ["mouser"] : []),
          ],
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="מחירון רשמי"
        subtitle="מחירי Digi-Key / Mouser מ-API — מחירי ייחוס ללקוח (לא הצעת מחיר סופית)"
        actions={
          <button
            type="button"
            onClick={() => loadResults()}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 text-[12px] bg-white hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            רענון
          </button>
        }
      />

      <Card className="p-4 border-blue-100 bg-blue-50/40">
        <div className="flex items-start gap-2 text-[12.5px] text-blue-900">
          <Globe className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            מחירון סין הוא פנימי בלבד. מחירון רשמי נמשך מ-API של ספקים (Digi-Key, Mouser) ומשמש
            לייצוא Customer BOM Cost Review.
          </div>
        </div>
      </Card>

      {config?.mock_mode && (
        <Card className="p-4 border-red-300 bg-red-50">
          <div className="flex items-start gap-2 text-[13px] text-red-900 font-medium">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            מצב דמו — המחירים אינם אמיתיים
          </div>
        </Card>
      )}

      {!config?.mock_mode && credentialsMissing && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-2 text-[12.5px] text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <div>
              <strong>API credentials missing</strong> — הגדר DIGIKEY_CLIENT_ID, DIGIKEY_CLIENT_SECRET
              ו/או MOUSER_API_KEY ב-.env, או הפעל SUPPLIER_API_MOCK=true לפיתוח.
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">פרויקט</label>
            <select className={sel} value={projectId ?? ""} onChange={(e) => setProjectId(Number(e.target.value))}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">גרסת BOM</label>
            <select className={sel} value={versionId ?? ""} onChange={(e) => setVersionId(Number(e.target.value))}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_name || v.version_label}
                  {v.is_active ? " ★" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">מצב משיכה</label>
            <select className={sel} value={mode} onChange={(e) => setMode(e.target.value as "all" | "missing_only")}>
              <option value="all">כל השורות</option>
              <option value="missing_only">חסרות מחיר בלבד</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-4 text-[12.5px]">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={suppliers.digikey}
              onChange={(e) => setSuppliers((s) => ({ ...s, digikey: e.target.checked }))}
            />
            Digi-Key
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={suppliers.mouser}
              onChange={(e) => setSuppliers((s) => ({ ...s, mouser: e.target.checked }))}
            />
            Mouser
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Card className="p-3 border-slate-200">
            <div className="text-[11px] text-slate-500 mb-1">Digi-Key API</div>
            {config?.digikey.mode === "real_api" ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Real API configured ({config.digikey.env})
              </span>
            ) : config?.digikey.mode === "mock" ? (
              <span className="text-[12px] text-red-700 font-medium">Mock mode active</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" /> Credentials missing
              </span>
            )}
            <div className="text-[10px] text-slate-400 mt-1">{supplierModeLabel(config?.digikey.mode ?? "")}</div>
          </Card>
          <Card className="p-3 border-slate-200">
            <div className="text-[11px] text-slate-500 mb-1">Mouser API</div>
            {config?.mouser.mode === "real_api" ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Real API configured
              </span>
            ) : config?.mouser.mode === "mock" ? (
              <span className="text-[12px] text-red-700 font-medium">Mock mode active</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" /> Credentials missing
              </span>
            )}
            <div className="text-[10px] text-slate-400 mt-1">{supplierModeLabel(config?.mouser.mode ?? "")}</div>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || projectId == null || versionId == null}
            onClick={doFetch}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand text-white text-[12.5px] disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            משוך מחירים רשמיים
          </button>
        </div>
      </Card>

      {error && (
        <Card className="p-3 border-red-200 bg-red-50 text-red-800 text-[12.5px]">{error}</Card>
      )}

      {fetchResult && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="שורות שנשלפו" value={String(fetchResult.total_lines)} />
          <Kpi label="מתומחרות" value={String(fetchResult.priced_count)} />
          <Kpi label="חסרות" value={String(fetchResult.missing_count)} />
          <Kpi label="שגיאות" value={String(fetchResult.error_count)} />
        </div>
      )}

      {fetchResult?.is_mock && config?.mock_mode && (
        <Card className="p-3 border-blue-200 bg-blue-50 text-blue-900 text-[12px]">
          Mock fetch — results are not real supplier prices.
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[11px] text-slate-500 block mb-1">שם Snapshot</label>
            <input
              className={sel}
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={busy || !lines.length}
            onClick={doSnapshot}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-slate-300 bg-white text-[12.5px] hover:bg-slate-50 disabled:opacity-50"
          >
            <Database className="w-4 h-4" />
            צור Official Price Snapshot
          </button>
        </div>

        {snapshot && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kpi label="Priced" value={String(snapshot.priced_count)} />
            <Kpi label="Missing" value={String(snapshot.missing_price_count)} />
            <Kpi label="Needs review" value={String(snapshot.needs_review_count)} />
            <Kpi
              label="Official total"
              value={fmtPrice(snapshot.official_components_total)}
            />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-right">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">MPN</th>
                <th className="py-2 px-2">Manufacturer</th>
                <th className="py-2 px-2">Req Qty</th>
                <th className="py-2 px-2">Digi-Key</th>
                <th className="py-2 px-2">Stock DK</th>
                <th className="py-2 px-2">Mouser</th>
                <th className="py-2 px-2">Stock MS</th>
                <th className="py-2 px-2">Official Source</th>
                <th className="py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln) => (
                <tr key={ln.bom_line_id} className={`border-b border-slate-100 ${ln.dnp ? "bg-slate-50 text-slate-400" : ""}`}>
                  <td className="py-1.5 px-2">{ln.line_no ?? "—"}</td>
                  <td className="py-1.5 px-2 font-mono text-[11px]">{ln.mpn ?? "—"}</td>
                  <td className="py-1.5 px-2">{ln.manufacturer ?? "—"}</td>
                  <td className="py-1.5 px-2">{ln.required_qty ?? "—"}</td>
                  <td className="py-1.5 px-2">{ln.dnp ? "—" : fmtPrice(ln.digikey?.unit_price, ln.digikey?.currency ?? "USD")}</td>
                  <td className="py-1.5 px-2">{ln.digikey?.available_qty ?? "—"}</td>
                  <td className="py-1.5 px-2">{ln.dnp ? "—" : fmtPrice(ln.mouser?.unit_price, ln.mouser?.currency ?? "USD")}</td>
                  <td className="py-1.5 px-2">{ln.mouser?.available_qty ?? "—"}</td>
                  <td className="py-1.5 px-2">{ln.dnp ? "DNP" : ln.selected_official_source ?? "TBD"}</td>
                  <td className="py-1.5 px-2">
                    {ln.dnp ? (
                      <Badge className="bg-slate-200 text-slate-600">DNP</Badge>
                    ) : (
                      <StatusBadge status={ln.digikey?.match_status || ln.mouser?.match_status} />
                    )}
                  </td>
                </tr>
              ))}
              {!lines.length && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    אין שורות — בחר פרויקט וגרסת BOM
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
