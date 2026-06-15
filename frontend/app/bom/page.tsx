"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Upload } from "lucide-react";
import { Card, PageHeader, Kpi, Badge } from "@/components/ui";
import { bomLines as mockLines } from "@/lib/mock-data";
import { apiGet } from "@/lib/api";

type ApiVersion = {
  id: number;
  project_id: number;
  version_label: string;
  status: string;
  is_active: boolean;
};

type ApiLine = {
  id: number;
  line_no: number | null;
  mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  quantity: string | number;
  unit: string | null;
  customer_price: string | number | null;
  internal_cost: string | number | null;
  is_critical: boolean;
};

const num = (v: string | number | null | undefined) =>
  v == null || v === "" ? 0 : Number(v);
const money = (v: string | number | null | undefined) => `$${num(v).toFixed(2)}`;

export default function BomTablePage() {
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [lines, setLines] = useState<ApiLine[]>([]);
  const [live, setLive] = useState(false);

  async function loadVersions() {
    try {
      const vs = await apiGet<ApiVersion[]>("/api/bom-versions");
      setVersions(vs);
      if (vs.length) {
        const active = vs.find((v) => v.is_active) ?? vs[vs.length - 1];
        setVersionId((cur) => cur ?? active.id);
        setLive(true);
      } else {
        setLive(false);
      }
    } catch {
      setLive(false);
    }
  }

  async function loadLines(id: number) {
    try {
      const ls = await apiGet<ApiLine[]>(`/api/bom-lines?bom_version_id=${id}`);
      setLines(ls);
    } catch {
      setLines([]);
    }
  }

  useEffect(() => {
    loadVersions();
  }, []);

  useEffect(() => {
    if (versionId != null) loadLines(versionId);
  }, [versionId]);

  const rows = live
    ? lines.map((l) => ({
        lineNo: l.line_no ?? 0,
        mpn: l.mpn ?? "—",
        manufacturer: l.manufacturer ?? "—",
        description: l.description ?? "",
        qty: num(l.quantity),
        unit: l.unit ?? "",
        internalCost: num(l.internal_cost),
        customerPrice: num(l.customer_price),
        critical: l.is_critical,
      }))
    : mockLines;

  const totalLines = rows.length;
  const criticalCount = rows.filter((r) => r.critical).length;
  const totalInternal = rows.reduce((s, r) => s + r.internalCost * r.qty, 0);
  const totalCustomer = rows.reduce((s, r) => s + r.customerPrice * r.qty, 0);
  const selected = versions.find((v) => v.id === versionId);

  return (
    <>
      <PageHeader
        title="טבלת BOM"
        subtitle="נתוני BOM אמיתיים מבסיס הנתונים"
        actions={
          <>
            <span
              className={
                "text-[10px] px-2 py-1 rounded-full border " +
                (live
                  ? "bg-green-50 text-risk-low border-green-200"
                  : "bg-slate-100 text-slate-500 border-slate-200")
              }
            >
              {live ? "● מחובר ל-API" : "○ נתוני דמו"}
            </span>
            {versions.length > 0 && (
              <select
                value={versionId ?? ""}
                onChange={(e) => setVersionId(Number(e.target.value))}
                className="h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    גרסה {v.version_label} (#{v.id}){v.is_active ? " ★" : ""}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => {
                loadVersions();
                if (versionId != null) loadLines(versionId);
              }}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="שורות BOM" value={totalLines} />
        <Kpi label="רכיבים קריטיים" value={criticalCount} tone="bad" />
        <Kpi label="Internal Cost (Total)" value={money(totalInternal)} />
        <Kpi label="Customer Value (Total)" value={money(totalCustomer)} tone="good" />
      </div>

      {selected && (
        <div className="mb-3 text-[12px] text-slate-500">
          גרסה פעילה: <span className="font-semibold text-slate-700">{selected.version_label}</span>{" "}
          · סטטוס {selected.status}
        </div>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-right">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">MPN</th>
              <th className="px-3 py-2 font-medium">Manufacturer</th>
              <th className="px-3 py-2 font-medium">תיאור</th>
              <th className="px-3 py-2 font-medium text-center">Qty</th>
              <th className="px-3 py-2 font-medium">Internal Cost</th>
              <th className="px-3 py-2 font-medium">Customer Price</th>
              <th className="px-3 py-2 font-medium text-center">קריטי</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                  אין שורות BOM בגרסה זו. נסה לייבא קובץ BOM.
                </td>
              </tr>
            ) : (
              rows.map((l, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-slate-400 tabular-nums">{l.lineNo}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{l.mpn}</td>
                  <td className="px-3 py-2">{l.manufacturer}</td>
                  <td className="px-3 py-2 text-slate-600">{l.description}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{l.qty}</td>
                  <td className="px-3 py-2 tabular-nums">{money(l.internalCost)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(l.customerPrice)}</td>
                  <td className="px-3 py-2 text-center">
                    {l.critical ? (
                      <Badge className="bg-red-50 text-risk-critical border-red-200">
                        Critical
                      </Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
