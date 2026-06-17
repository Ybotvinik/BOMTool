"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { apiGet } from "@/lib/api";
import type { QualityLine } from "@/components/EditBomLineModal";
import type { BomSummary } from "./types";

function SeverityBadge({ status }: { status: string }) {
  if (status === "error")
    return <Badge className="bg-red-50 text-risk-critical border-red-200">Error</Badge>;
  if (status === "warning")
    return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Warning</Badge>;
  return <Badge className="bg-green-50 text-risk-low border-green-200">OK</Badge>;
}

export function BomIssuesPanel({
  versionId,
  tabQuery,
  summary,
  onEdit,
  onReview,
}: {
  versionId: number | null;
  tabQuery?: Record<string, string | number | null | undefined>;
  summary: BomSummary | null;
  onEdit?: (line: QualityLine) => void;
  onReview?: (line: QualityLine) => void;
}) {
  const [issues, setIssues] = useState<QualityLine[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      setIssues(await apiGet<QualityLine[]>(`/api/bom-versions/${id}/quality-issues`));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (versionId != null) load(versionId);
    else setIssues([]);
  }, [versionId, load]);

  function bomLineHref(lineId: number) {
    const params = new URLSearchParams();
    if (tabQuery) {
      for (const [key, value] of Object.entries(tabQuery)) {
        if (value != null && value !== "") params.set(key, String(value));
      }
    }
    params.set("tab", "lines");
    params.set("line_id", String(lineId));
    return `/bom?${params.toString()}`;
  }

  if (versionId == null) {
    return (
      <Card className="p-8 text-center text-slate-400 text-[13px]">
        בחר פרויקט וגרסת BOM לצפייה בחריגים ובעיות.
      </Card>
    );
  }

  const errorCount = summary?.error_count ?? 0;
  const warnCount = summary?.warning_count ?? 0;
  const reviewCount = summary?.needs_review_count ?? 0;

  return (
    <>
      {!loading && issues.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Card className="p-2.5 text-center">
            <div className="text-[10px] text-slate-500">Errors</div>
            <div className="text-[18px] font-bold text-red-700 tabular-nums">{errorCount}</div>
          </Card>
          <Card className="p-2.5 text-center">
            <div className="text-[10px] text-slate-500">Warnings</div>
            <div className="text-[18px] font-bold text-amber-700 tabular-nums">{warnCount}</div>
          </Card>
          <Card className="p-2.5 text-center">
            <div className="text-[10px] text-slate-500">Needs Review</div>
            <div className="text-[18px] font-bold text-amber-700 tabular-nums">{reviewCount}</div>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
            <Loader2 className="h-4 w-4 animate-spin" /> טוען חריגים...
          </div>
        ) : issues.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-risk-low text-[13px]">
            <ShieldCheck className="h-7 w-7" /> אין חריגים או בעיות בגרסה זו.
          </div>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 bg-amber-50/50">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-[12px] text-amber-800">
                {issues.length} שורות עם חריגים / בעיות — יש לטפל לפני תמחור וייצוא
              </span>
            </div>
            <div className="overflow-auto max-h-[calc(100vh-16rem)]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-right sticky top-0">
                    <th className="px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Severity</th>
                    <th className="px-2 py-2 font-medium min-w-[180px]">Issue / Review Reason</th>
                    <th className="px-2 py-2 font-medium">MPN</th>
                    <th className="px-2 py-2 font-medium">Manufacturer</th>
                    <th className="px-2 py-2 font-medium min-w-[160px]">Description</th>
                    <th className="px-2 py-2 font-medium text-center">Qty</th>
                    <th className="px-2 py-2 font-medium">RefDes</th>
                    <th className="px-2 py-2 font-medium text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((r) => (
                    <tr key={r.line_id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-2 py-1.5 text-slate-400 tabular-nums">{r.line_number}</td>
                      <td className="px-2 py-1.5">
                        <SeverityBadge status={r.quality_status} />
                      </td>
                      <td className="px-2 py-1.5 text-amber-700">{r.review_reason || "—"}</td>
                      <td className="px-2 py-1.5 font-medium tabular-nums">{r.original_mpn || "—"}</td>
                      <td className="px-2 py-1.5">{r.manufacturer || "—"}</td>
                      <td className="px-2 py-1.5 text-slate-600 max-w-[220px] truncate">
                        {r.original_description || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums">
                        {r.qty_per_assembly ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600 max-w-[140px] truncate">
                        {r.reference_designators || "—"}
                      </td>
                      <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(r)}
                            title="ערוך רכיב"
                            className="h-7 px-2 rounded-md border border-slate-200 text-[10px] hover:bg-slate-50"
                          >
                            ערוך
                          </button>
                        )}
                        {onReview && r.quality_status !== "error" && (
                          <button
                            type="button"
                            onClick={() => onReview(r)}
                            title="סמן כנבדק"
                            className="h-7 px-2 rounded-md border border-green-200 text-[10px] hover:bg-green-50 text-green-700"
                          >
                            נבדק
                          </button>
                        )}
                        <Link
                            href={bomLineHref(r.line_id)}
                            title="פתח בשורות BOM"
                            className="h-7 px-2 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-brand text-[10px] font-medium"
                          >
                            BOM
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
