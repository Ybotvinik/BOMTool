"use client";

import { Pencil, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui";
import type { QualityLine } from "@/components/EditBomLineModal";

function QualityStatusBadge({ status }: { status: string }) {
  if (status === "error")
    return <Badge className="bg-red-50 text-risk-critical border-red-200">Error</Badge>;
  if (status === "warning")
    return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Warning</Badge>;
  return <Badge className="bg-green-50 text-risk-low border-green-200">OK</Badge>;
}

function ReviewStatusBadge({ status }: { status?: string }) {
  if (status === "corrected")
    return <Badge className="bg-blue-50 text-blue-700 border-blue-200">תוקן</Badge>;
  if (status === "reviewed")
    return <Badge className="bg-slate-100 text-slate-600 border-slate-200">נבדק</Badge>;
  if (status === "open")
    return <Badge className="bg-amber-50 text-amber-700 border-amber-200">פתוח</Badge>;
  return <Badge className="bg-green-50 text-risk-low border-green-200">OK</Badge>;
}

export function BomLinesTable({
  rows,
  compact = false,
  onEdit,
  onReview,
  emptyMessage = "אין שורות התואמות לסינון.",
}: {
  rows: QualityLine[];
  compact?: boolean;
  onEdit?: (line: QualityLine) => void;
  onReview?: (line: QualityLine) => void;
  emptyMessage?: string;
}) {
  const hasActions = Boolean(onEdit || onReview);
  const colSpan = (compact ? 10 : 12) + (hasActions ? 1 : 0);

  return (
    <div className="overflow-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-right sticky top-0 z-[1]">
            <th className="px-2 py-2 font-medium w-10">#</th>
            <th className="px-2 py-2 font-medium min-w-[120px]">MPN</th>
            {!compact && <th className="px-2 py-2 font-medium min-w-[100px]">Cleaned MPN</th>}
            <th className="px-2 py-2 font-medium min-w-[90px]">Manufacturer</th>
            <th className="px-2 py-2 font-medium min-w-[180px]">Description</th>
            <th className="px-2 py-2 font-medium text-center w-14">Qty</th>
            {!compact && <th className="px-2 py-2 font-medium text-center w-16">Req Qty</th>}
            <th className="px-2 py-2 font-medium text-center w-14">DNP</th>
            <th className="px-2 py-2 font-medium w-24">Quality</th>
            <th className="px-2 py-2 font-medium w-20">Review</th>
            <th className="px-2 py-2 font-medium min-w-[140px]">Issues / Notes</th>
            {hasActions && <th className="px-2 py-2 font-medium text-center min-w-[140px]">פעולות</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const noteText =
              [r.review_reason, r.correction_note, r.quality_review_note, r.notes]
                .filter(Boolean)
                .join(" · ") || "—";
            const canReview =
              r.needs_review && r.quality_status !== "error" && r.review_status !== "reviewed";
            return (
              <tr key={r.line_id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-2 py-1.5 text-slate-400 tabular-nums">{r.line_number ?? "—"}</td>
                <td className="px-2 py-1.5 font-medium tabular-nums">{r.original_mpn || "—"}</td>
                {!compact && (
                  <td className="px-2 py-1.5 tabular-nums text-slate-500">{r.cleaned_mpn || "—"}</td>
                )}
                <td className="px-2 py-1.5">{r.manufacturer || "—"}</td>
                <td
                  className="px-2 py-1.5 text-slate-600 max-w-[240px] truncate"
                  title={r.original_description ?? ""}
                >
                  {r.original_description || "—"}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">{r.qty_per_assembly ?? "—"}</td>
                {!compact && (
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.required_qty ?? "—"}</td>
                )}
                <td className="px-2 py-1.5 text-center">
                  {r.is_dnp ? (
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200">DNP</Badge>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <QualityStatusBadge status={r.quality_status} />
                </td>
                <td className="px-2 py-1.5">
                  <ReviewStatusBadge status={r.review_status} />
                </td>
                <td className="px-2 py-1.5 text-[11px] text-amber-700 max-w-[220px] truncate" title={noteText}>
                  {noteText}
                </td>
                {hasActions && (
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(r)}
                          title="ערוך רכיב"
                          className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 text-[10.5px] hover:bg-slate-50 text-slate-600"
                        >
                          <Pencil className="h-3 w-3" />
                          ערוך
                        </button>
                      )}
                      {onReview && canReview && (
                        <button
                          type="button"
                          onClick={() => onReview(r)}
                          title="סמן כנבדק"
                          className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-green-200 text-[10.5px] hover:bg-green-50 text-green-700"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          נבדק
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-3 py-8 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
