"use client";

import clsx from "clsx";
import { Lock, TrendingDown, TrendingUp } from "lucide-react";
import { fmtPrice, type PricingComparison } from "./types";

type ChipVariant = "neutral" | "green" | "amber" | "red" | "blue";

const chipStyles: Record<ChipVariant, string> = {
  neutral: "bg-slate-50 text-slate-700 border-slate-200",
  green: "bg-green-50 text-green-800 border-green-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-800 border-blue-200",
};

function MetricChip({
  label,
  value,
  variant = "neutral",
}: {
  label: string;
  value: string | number;
  variant?: ChipVariant;
}) {
  return (
    <div
      className={clsx(
        "rounded-md border px-1.5 py-1 text-center min-w-0",
        chipStyles[variant],
      )}
    >
      <p className="text-[8.5px] leading-tight opacity-80 truncate">{label}</p>
      <p className="text-[13px] font-bold tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
}

function LabelChip({
  label,
  variant = "neutral",
  icon,
}: {
  label: string;
  variant?: ChipVariant;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-md border px-1.5 py-1.5 flex items-center justify-center gap-1 min-w-0",
        chipStyles[variant],
      )}
    >
      {icon}
      <span className="text-[8.5px] font-semibold leading-tight text-center">{label}</span>
    </div>
  );
}

function MetricsGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-1 mt-2">{children}</div>;
}

export function PricingComparisonCards({
  comparison,
  activeModeEast,
}: {
  comparison: PricingComparison | null;
  activeModeEast: boolean;
}) {
  if (!comparison) return null;

  const { official_only: off, with_east: east, savings } = comparison;
  const isSaving = savings.is_saving && savings.amount > 0;
  const isGap = savings.amount < 0;

  const cardBase = "rounded-lg border p-2.5 flex flex-col min-h-[148px]";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 shrink-0">
      {/* Card A — Official only */}
      <div
        className={clsx(
          cardBase,
          !activeModeEast ? "border-brand/40 bg-brand/5 ring-1 ring-brand/20" : "border-slate-200 bg-white",
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-navy leading-tight">מחיר רשמי בלבד</p>
            <p className="text-[8.5px] text-slate-500 mt-0.5 truncate">Digi-Key / Mouser / TI / Manual</p>
          </div>
          {!activeModeEast && (
            <span className="shrink-0 text-[8px] px-1.5 py-0.5 rounded bg-brand text-white font-medium">
              פעיל
            </span>
          )}
        </div>
        <p className="text-[22px] font-bold tabular-nums text-slate-900 mt-1.5 leading-none">
          {fmtPrice(off.total)}
        </p>
        <MetricsGrid>
          <MetricChip label="שורות מתומחרות" value={off.priced_lines} variant="blue" />
          <MetricChip label="דורש אישור" value={off.needs_approval} variant="amber" />
          <MetricChip label="אין פתרון" value={off.no_solution} variant={off.no_solution > 0 ? "red" : "neutral"} />
          <MetricChip label="ללא מלאי" value={off.no_stock} variant="amber" />
        </MetricsGrid>
      </div>

      {/* Card B — With East */}
      <div
        className={clsx(
          cardBase,
          activeModeEast ? "border-amber-400/50 bg-amber-50/50 ring-1 ring-amber-200" : "border-slate-200 bg-white",
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-navy leading-tight">מחיר משולב עם מזרח</p>
            <p className="text-[8.5px] text-slate-500 mt-0.5 truncate">כולל Link / ספקי מזרח</p>
          </div>
          {activeModeEast && (
            <span className="shrink-0 text-[8px] px-1.5 py-0.5 rounded bg-amber-600 text-white font-medium">
              פעיל
            </span>
          )}
        </div>
        <p className="text-[22px] font-bold tabular-nums text-slate-900 mt-1.5 leading-none">
          {fmtPrice(east.total)}
        </p>
        <MetricsGrid>
          <MetricChip label="שורות מתומחרות" value={east.priced_lines} variant="blue" />
          <MetricChip label="נבחרו מזרח" value={east.east_selected_lines} variant="amber" />
          <MetricChip label="דורש אישור" value={east.needs_approval} variant="amber" />
          <MetricChip label="ללא מלאי" value={east.no_stock} variant="amber" />
        </MetricsGrid>
      </div>

      {/* Card C — Savings */}
      <div
        className={clsx(
          cardBase,
          isSaving
            ? "border-green-200 bg-green-50/60"
            : isGap
              ? "border-amber-200 bg-amber-50/40"
              : "border-slate-200 bg-white",
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <p className="text-[12px] font-bold text-navy leading-tight">
            {isSaving ? "חיסכון משוער" : isGap ? "פער / תוספת" : "השוואת תרחישים"}
          </p>
          {isSaving && (
            <span className="shrink-0 text-[8px] px-1.5 py-0.5 rounded bg-green-600 text-white font-medium">
              חיסכון
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2 mt-1.5">
          {isSaving ? (
            <TrendingDown className="w-4 h-4 text-green-600 shrink-0" />
          ) : isGap ? (
            <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
          ) : null}
          <p
            className={clsx(
              "text-[22px] font-bold tabular-nums leading-none",
              isSaving ? "text-green-700" : isGap ? "text-amber-700" : "text-slate-800",
            )}
          >
            {fmtPrice(Math.abs(savings.amount))}
          </p>
          {savings.percent != null && (
            <p
              className={clsx(
                "text-[13px] font-semibold tabular-nums",
                isSaving ? "text-green-700" : "text-amber-700",
              )}
            >
              {isSaving ? "−" : "+"}
              {Math.abs(savings.percent).toFixed(1)}%
            </p>
          )}
        </div>
        <MetricsGrid>
          <MetricChip label="שורות מזרח" value={east.east_selected_lines} variant="amber" />
          <LabelChip
            label="פנימי בלבד"
            variant="amber"
            icon={<Lock className="w-2.5 h-2.5 shrink-0 opacity-70" />}
          />
          <LabelChip label="לעומת רשמי בלבד" variant="blue" />
          <LabelChip label="לא לדוח לקוח" variant="amber" />
        </MetricsGrid>
      </div>
    </div>
  );
}
