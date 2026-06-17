"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, ChevronLeft } from "lucide-react";
import clsx from "clsx";
import { Card, Kpi } from "@/components/ui";
import { apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import { BomLinesTable } from "./BomLinesTable";
import type { BomFilterKey, BomSummary } from "./types";
import { matchesBomFilter, qualityScoreLabel, qualityScoreTone } from "./types";
import type { QualityLine } from "@/components/EditBomLineModal";

function QualityScoreGauge({ score }: { score: number }) {
  const tone = qualityScoreTone(score);
  const barColor =
    tone === "good" ? "bg-green-500" : tone === "warn" ? "bg-amber-500" : "bg-red-500";
  const textColor =
    tone === "good" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-red-700";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] text-slate-500">Quality Score</div>
          <div className={clsx("text-[28px] font-bold tabular-nums mt-0.5", textColor)}>{score}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{qualityScoreLabel(score)}</div>
          <p className="text-[10px] text-slate-400 mt-2 max-w-xs leading-relaxed">
            ציון 0–100: מוריד נקודות על שגיאות (−5), אזהרות (−2) ו-DNP (−0.5). 90+ טוב, 70–89 דורש
            בדיקה, מתחת ל-70 איכות נמוכה.
          </p>
        </div>
        <div className="flex-1 max-w-[200px] pt-1">
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={clsx("h-full rounded-full transition-all", barColor)}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 mt-1">
            <span>0</span>
            <span>70</span>
            <span>90</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

type AttentionItem = {
  key: BomFilterKey;
  label: string;
  count: number;
  explanation: string;
  tone: "good" | "warn" | "bad" | "neutral";
};

function AttentionCard({
  item,
  onFilter,
}: {
  item: AttentionItem;
  onFilter: (key: BomFilterKey) => void;
}) {
  const toneBorder = {
    good: "border-green-200 hover:border-green-300",
    warn: "border-amber-200 hover:border-amber-300",
    bad: "border-red-200 hover:border-red-300",
    neutral: "border-slate-200 hover:border-slate-300",
  }[item.tone];
  const toneCount = {
    good: "text-green-700",
    warn: "text-amber-700",
    bad: "text-red-700",
    neutral: "text-slate-700",
  }[item.tone];

  return (
    <button
      type="button"
      onClick={() => onFilter(item.key)}
      className={clsx(
        "text-right p-3 rounded-lg border bg-white transition-colors hover:bg-slate-50/80 w-full",
        toneBorder,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-slate-800">{item.label}</span>
        <span className={clsx("text-[18px] font-bold tabular-nums", toneCount)}>{item.count}</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{item.explanation}</p>
    </button>
  );
}

export function BomQualityPanel({
  versionId,
  summary,
  rows,
  loading,
  tabQuery,
  onReload,
  onFilterNavigate,
  onEdit,
  onReview,
}: {
  versionId: number | null;
  summary: BomSummary | null;
  rows: QualityLine[];
  loading: boolean;
  tabQuery?: Record<string, string | number | null | undefined>;
  onReload?: () => void;
  onFilterNavigate: (filter: BomFilterKey) => void;
  onEdit?: (line: QualityLine) => void;
  onReview?: (line: QualityLine) => void;
}) {
  const { user } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<BomFilterKey>("open");

  async function reanalyze() {
    if (versionId == null) return;
    setBusy(true);
    try {
      await apiPost(`/api/bom-versions/${versionId}/reanalyze-quality`, {}, user.id);
      onReload?.();
    } finally {
      setBusy(false);
    }
  }

  if (versionId == null) {
    return (
      <Card className="p-8 text-center text-slate-400 text-[13px]">
        בחר פרויקט וגרסת BOM לצפייה בניתוח איכות.
      </Card>
    );
  }

  const score = summary?.quality_score ?? 0;
  const attentionItems: AttentionItem[] = [
    {
      key: "missing_mpn",
      label: "Missing MPN",
      count: summary?.missing_mpn_count ?? 0,
      explanation:
        (summary?.missing_mpn_count ?? 0) === 0
          ? "כל הרכיבים כוללים MPN"
          : "שורות ללא MPN — דורש השלמה לפני תמחור",
      tone: (summary?.missing_mpn_count ?? 0) === 0 ? "good" : "bad",
    },
    {
      key: "missing_qty",
      label: "Missing Qty",
      count: summary?.missing_qty_count ?? 0,
      explanation:
        (summary?.missing_qty_count ?? 0) === 0
          ? "לכל השורות יש כמות"
          : "שורות ללא כמות — חובה לתקן",
      tone: (summary?.missing_qty_count ?? 0) === 0 ? "good" : "bad",
    },
    {
      key: "needs_review",
      label: "Needs Review",
      count: summary?.needs_review_count ?? 0,
      explanation:
        (summary?.needs_review_count ?? 0) === 0
          ? "אין שורות הממתינות לבדיקה"
          : "רכיבים שדורשים בדיקת איכות נתונים",
      tone: (summary?.needs_review_count ?? 0) === 0 ? "good" : "warn",
    },
    {
      key: "warning",
      label: "Warnings",
      count: summary?.warning_count ?? 0,
      explanation:
        (summary?.warning_count ?? 0) === 0
          ? "אין אזהרות פעילות"
          : "שורות עם אזהרות — מומלץ לבדוק",
      tone: (summary?.warning_count ?? 0) === 0 ? "good" : "warn",
    },
    {
      key: "error",
      label: "Errors",
      count: summary?.error_count ?? 0,
      explanation:
        (summary?.error_count ?? 0) === 0
          ? "אין שגיאות קריטיות"
          : "שגיאות שחוסמות שימוש בנתונים",
      tone: (summary?.error_count ?? 0) === 0 ? "good" : "bad",
    },
    {
      key: "dnp",
      label: "DNP",
      count: summary?.dnp_count ?? 0,
      explanation:
        (summary?.dnp_count ?? 0) === 0
          ? "אין רכיבי DNP בגרסה זו"
          : "רכיבים שלא מיועדים להרכבה",
      tone: "neutral",
    },
  ];

  const previewRows = rows.filter((r) => matchesBomFilter(r, previewFilter)).slice(0, 15);

  function linesTabHref(filter: BomFilterKey) {
    const params = new URLSearchParams();
    if (tabQuery) {
      for (const [key, value] of Object.entries(tabQuery)) {
        if (value != null && value !== "") params.set(key, String(value));
      }
    }
    params.set("tab", "lines");
    if (filter !== "all") params.set("filter", filter);
    return `/bom?${params.toString()}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={reanalyze}
          disabled={busy || loading}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          נתח מחדש איכות BOM
        </button>
      </div>

      {loading ? (
        <Card className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
          <Loader2 className="h-4 w-4 animate-spin" /> טוען ניתוח איכות...
        </Card>
      ) : (
        <>
          <QualityScoreGauge score={score} />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <Kpi label="Total" value={summary?.total_lines ?? 0} hint="סה״כ שורות BOM" />
            <Kpi label="OK" value={summary?.ok_count ?? 0} tone="good" hint="שורות תקינות" />
            <Kpi
              label="Warnings"
              value={summary?.warning_count ?? 0}
              tone="warn"
              hint="אזהרות איכות"
            />
            <Kpi label="Errors" value={summary?.error_count ?? 0} tone="bad" hint="שגיאות קריטיות" />
            <Kpi
              label="Needs Review"
              value={summary?.needs_review_count ?? 0}
              tone="warn"
              hint="ממתין לבדיקה ידנית"
            />
            <Kpi label="DNP" value={summary?.dnp_count ?? 0} hint="Do Not Populate" />
            <Kpi
              label="Missing MPN"
              value={summary?.missing_mpn_count ?? 0}
              tone={(summary?.missing_mpn_count ?? 0) > 0 ? "bad" : "good"}
              hint="ללא מק״ט"
            />
            <Kpi
              label="Missing Qty"
              value={summary?.missing_qty_count ?? 0}
              tone={(summary?.missing_qty_count ?? 0) > 0 ? "bad" : "good"}
              hint="ללא כמות"
            />
          </div>

          <Card className="p-3">
            <h3 className="text-[13px] font-bold text-navy mb-2.5">מה דורש טיפול</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {attentionItems.map((item) => (
                <AttentionCard key={item.key} item={item} onFilter={onFilterNavigate} />
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-bold text-navy">תצוגת שורות — דורשות טיפול</h3>
              <div className="flex flex-wrap gap-1 ms-auto">
                {(
                  [
                    ["open", "דורש טיפול"],
                    ["corrected", "תוקן"],
                    ["reviewed", "נבדק"],
                    ["error", "Errors"],
                    ["warning", "Warnings"],
                    ["missing_mpn", "Missing MPN"],
                    ["missing_qty", "Missing Qty"],
                    ["dnp", "DNP"],
                    ["all", "הכל"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreviewFilter(key)}
                    className={clsx(
                      "h-7 px-2 rounded-md text-[11px] border",
                      previewFilter === key
                        ? "bg-brand text-brand-fg border-brand"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[360px] overflow-auto">
              <BomLinesTable
                rows={previewRows}
                compact
                onEdit={onEdit}
                onReview={onReview}
                emptyMessage={
                  rows.length === 0
                    ? "אין נתוני שורות זמינים במסך זה"
                    : "אין שורות בקטגוריה זו — מצוין!"
                }
              />
            </div>
            <div className="px-3 py-2 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-[11px] text-slate-500">
                מציג עד 15 שורות · סינון: {previewFilter}
              </span>
              <Link
                href={linesTabHref(previewFilter)}
                className="inline-flex items-center gap-1 text-[12px] text-brand font-medium hover:underline"
              >
                עבור לטבלת שורות BOM
                <ChevronLeft className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
