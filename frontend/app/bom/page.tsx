"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Upload, Loader2, AlertTriangle, Inbox } from "lucide-react";
import { Card, PageHeader, Kpi, Badge } from "@/components/ui";
import { API_URL, apiGet } from "@/lib/api";

type ApiVersion = {
  id: number;
  project_id: number;
  version_label: string;
  status: string;
  is_active: boolean;
};

type ApiProject = { id: number; name: string; active_version_id: number | null };

// Backend returns snake_case. We also defensively accept richer aliases
// (matched_mpn / cleaned_mpn / original_mpn, qty_per_assembly, is_dnp, …).
type ApiLine = Record<string, unknown>;

type Status = "idle" | "loading" | "ok" | "empty" | "error" | "no-version";

const s = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
const money = (v: unknown) => `$${num(v).toFixed(2)}`;
const bool = (v: unknown) => v === true || v === "true" || v === 1;

function pick(line: ApiLine, ...keys: string[]): unknown {
  for (const k of keys) {
    if (line[k] != null && line[k] !== "") return line[k];
  }
  return undefined;
}

function mapLine(l: ApiLine) {
  return {
    lineNo: num(pick(l, "line_no")),
    mpn: s(pick(l, "matched_mpn", "cleaned_mpn", "mpn", "original_mpn")) || "—",
    manufacturer: s(pick(l, "matched_manufacturer", "manufacturer")) || "—",
    description: s(pick(l, "description", "original_description")),
    qty: num(pick(l, "qty_per_assembly", "quantity", "required_qty")),
    footprint: s(pick(l, "footprint")),
    value: s(pick(l, "value", "value_text")),
    ref: s(pick(l, "reference_designators")),
    internalCost: num(pick(l, "internal_cost")),
    customerPrice: num(pick(l, "customer_price")),
    critical: bool(pick(l, "is_critical")),
    dnp: bool(pick(l, "is_dnp", "dnp")),
    needsReview: bool(pick(l, "needs_review")) || !s(pick(l, "mpn", "matched_mpn")),
  };
}

function BomTableInner() {
  const searchParams = useSearchParams();
  const urlVersionId = searchParams.get("version_id");

  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [versionId, setVersionId] = useState<number | null>(
    urlVersionId ? Number(urlVersionId) : null,
  );
  const [projectId, setProjectId] = useState<number | null>(null);
  const [lines, setLines] = useState<ApiLine[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [lastUrl, setLastUrl] = useState<string>("");

  const loadLines = useCallback(async (id: number) => {
    const path = `/api/bom-versions/${id}/lines`;
    setLastUrl(`${API_URL}${path}`);
    setStatus("loading");
    setErrorMsg("");
    try {
      const data = await apiGet<ApiLine[]>(path);
      setLines(data);
      setStatus(data.length > 0 ? "ok" : "empty");
    } catch (e) {
      setLines([]);
      setStatus("error");
      setErrorMsg(String(e));
    }
  }, []);

  // Resolve which version to show: URL param wins, else the current project's
  // active version. Also load the versions list for the dropdown.
  useEffect(() => {
    (async () => {
      let vs: ApiVersion[] = [];
      try {
        vs = await apiGet<ApiVersion[]>("/api/bom-versions");
        setVersions(vs);
      } catch {
        /* versions list optional */
      }

      if (urlVersionId) {
        const id = Number(urlVersionId);
        setVersionId(id);
        const v = vs.find((x) => x.id === id);
        setProjectId(v ? v.project_id : null);
        loadLines(id);
        return;
      }

      // Fallback: current project's active_version_id.
      try {
        const projects = await apiGet<ApiProject[]>("/api/projects");
        const current = projects[0];
        if (current) {
          setProjectId(current.id);
          if (current.active_version_id) {
            setVersionId(current.active_version_id);
            loadLines(current.active_version_id);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setStatus("no-version");
    })();
  }, [urlVersionId, loadLines]);

  function onSelectVersion(id: number) {
    setVersionId(id);
    const v = versions.find((x) => x.id === id);
    if (v) setProjectId(v.project_id);
    loadLines(id);
  }

  const rows = lines.map(mapLine);
  const totalLines = rows.length;
  const criticalCount = rows.filter((r) => r.critical).length;
  const reviewCount = rows.filter((r) => r.needsReview).length;
  const totalInternal = rows.reduce((acc, r) => acc + r.internalCost * r.qty, 0);
  const selected = versions.find((v) => v.id === versionId);
  const isDev = process.env.NODE_ENV === "development";

  return (
    <>
      <PageHeader
        title="טבלת BOM"
        subtitle="נתוני BOM אמיתיים מבסיס הנתונים"
        actions={
          <>
            {versions.length > 0 && (
              <select
                value={versionId ?? ""}
                onChange={(e) => onSelectVersion(Number(e.target.value))}
                className="h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white"
              >
                <option value="" disabled>
                  בחר גרסה
                </option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    גרסה {v.version_label} (#{v.id}){v.is_active ? " ★" : ""}
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
            <Link
              href="/upload-bom"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90"
            >
              <Upload className="h-3.5 w-3.5" /> טעינת BOM
            </Link>
          </>
        }
      />

      {isDev && (
        <div className="mb-3 rounded-md border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-600 px-3 py-2 font-mono">
          <span className="font-semibold">debug</span> · project_id={s(projectId) || "—"} ·
          version_id={s(versionId) || "—"} · status={status} · rows={totalLines} · api=
          {lastUrl || "—"}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="שורות BOM" value={totalLines} />
        <Kpi label="רכיבים קריטיים" value={criticalCount} tone="bad" />
        <Kpi label="Needs Review" value={reviewCount} tone="warn" />
        <Kpi label="Internal Cost (Total)" value={money(totalInternal)} />
      </div>

      {selected && (
        <div className="mb-3 text-[12px] text-slate-500">
          גרסה: <span className="font-semibold text-slate-700">{selected.version_label}</span> · סטטוס{" "}
          {selected.status}
        </div>
      )}

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
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-right">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">MPN</th>
                <th className="px-3 py-2 font-medium">Manufacturer</th>
                <th className="px-3 py-2 font-medium">תיאור</th>
                <th className="px-3 py-2 font-medium">Ref Des</th>
                <th className="px-3 py-2 font-medium">Footprint</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium text-center">Qty</th>
                <th className="px-3 py-2 font-medium text-center">DNP</th>
                <th className="px-3 py-2 font-medium text-center">Review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-slate-400 tabular-nums">{l.lineNo}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{l.mpn}</td>
                  <td className="px-3 py-2">{l.manufacturer}</td>
                  <td className="px-3 py-2 text-slate-600">{l.description}</td>
                  <td className="px-3 py-2 text-slate-600">{l.ref || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{l.footprint || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{l.value || "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{l.qty}</td>
                  <td className="px-3 py-2 text-center">
                    {l.dnp ? (
                      <Badge className="bg-slate-100 text-slate-600 border-slate-200">DNP</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {l.needsReview ? (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200">Review</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

export default function BomTablePage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
          <Loader2 className="h-4 w-4 animate-spin" /> טוען...
        </div>
      }
    >
      <BomTableInner />
    </Suspense>
  );
}
