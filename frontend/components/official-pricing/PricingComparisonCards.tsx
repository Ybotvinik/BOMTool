"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { AlertTriangle, Lock, TrendingDown, TrendingUp } from "lucide-react";
import { fmtPrice, type PricingComparison, type WorkbenchSummary } from "./types";

function MiniChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass = {
    neutral: "bg-slate-50 text-slate-700 border-slate-200",
    green: "bg-green-50 text-green-800 border-green-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-800 border-blue-200",
  }[tone];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] whitespace-nowrap",
        toneClass,
      )}
    >
      <span className="opacity-75">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );
}

export function PricingComparisonCards({
  comparison,
  activeModeEast,
  buildQuantity = null,
  summary = null,
}: {
  comparison: PricingComparison | null;
  activeModeEast: boolean;
  buildQuantity?: number | null;
  summary?: WorkbenchSummary | null;
}) {
  if (!comparison) return null;

  const { official_only: off, with_east: east, savings } = comparison;
  const isSaving = savings.is_saving && savings.amount > 0;
  const isGap = savings.amount < 0;

  function unitLabel(total: number) {
    if (buildQuantity == null || buildQuantity <= 0 || total <= 0) return null;
    return fmtPrice(total / buildQuantity);
  }

  const activeTotal = activeModeEast ? east.total : off.total;
  const activeUnit = unitLabel(activeTotal);
  const excludedNoSolution = summary?.no_solution ?? 0;
  const excludedDnp = summary?.dnp ?? 0;
  const hasGap = excludedNoSolution > 0 || excludedDnp > 0;

  const cardBase = "rounded-md border px-2 py-1.5 flex flex-col min-w-0";

  function ScenarioCard({
    title,
    sub,
    total,
    active,
    accent,
    chips,
  }: {
    title: string;
    sub: string;
    total: number;
    active: boolean;
    accent: "brand" | "amber";
    chips: ReactNode;
  }) {
    const unit = unitLabel(total);
    return (
      <div
        className={clsx(
          cardBase,
          active
            ? accent === "brand"
              ? "border-brand/40 bg-brand/5 ring-1 ring-brand/15"
              : "border-amber-400/50 bg-amber-50/60 ring-1 ring-amber-200/80"
            : "border-slate-200 bg-white opacity-90",
        )}
      >
        <div className="flex items-center justify-between gap-1 min-h-[16px]">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold text-navy leading-tight truncate">{title}</p>
            <p className="text-[8px] text-slate-500 truncate">{sub}</p>
          </div>
          {active && (
            <span
              className={clsx(
                "shrink-0 text-[7.5px] px-1 py-px rounded font-medium text-white",
                accent === "brand" ? "bg-brand" : "bg-amber-600",
              )}
            >
              פעיל
            </span>
          )}
        </div>
        {active && unit ? (
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <p className="text-[18px] font-bold tabular-nums text-emerald-800 leading-none">{unit}</p>
            <span className="text-[8px] text-emerald-700/90">ליחידה</span>
            <span className="text-[10px] font-semibold tabular-nums text-slate-700 ms-auto">
              {fmtPrice(total)}
              {buildQuantity != null ? (
                <span className="text-[8px] font-normal text-slate-400 mr-1">
                  (×{buildQuantity.toLocaleString()})
                </span>
              ) : null}
            </span>
          </div>
        ) : (
          <div className="mt-1 flex items-baseline gap-1.5">
            <p className="text-[15px] font-bold tabular-nums text-slate-900 leading-none">
              {fmtPrice(total)}
            </p>
            {unit && (
              <span className="text-[9px] text-slate-500 tabular-nums">{unit}/יח׳</span>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1 mt-1">{chips}</div>
      </div>
    );
  }

  return (
    <div className="shrink-0 space-y-1">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
        <ScenarioCard
          title="מחיר רשמי בלבד"
          sub="Digi-Key / Mouser / TI"
          total={off.total}
          active={!activeModeEast}
          accent="brand"
          chips={
            <>
              <MiniChip label="מתומחר" value={off.priced_lines} tone="blue" />
              <MiniChip label="אין פתרון" value={off.no_solution} tone={off.no_solution ? "red" : "neutral"} />
              <MiniChip label="דורש אישור" value={off.needs_approval} tone="amber" />
            </>
          }
        />
        <ScenarioCard
          title="משולב עם מזרח"
          sub="Link / ספקי מזרח"
          total={east.total}
          active={activeModeEast}
          accent="amber"
          chips={
            <>
              <MiniChip label="מתומחר" value={east.priced_lines} tone="blue" />
              <MiniChip label="מזרח" value={east.east_selected_lines} tone="amber" />
              <MiniChip label="דורש אישור" value={east.needs_approval} tone="amber" />
            </>
          }
        />
        <div
          className={clsx(
            cardBase,
            isSaving
              ? "border-green-200 bg-green-50/50"
              : isGap
                ? "border-amber-200 bg-amber-50/30"
                : "border-slate-200 bg-white",
          )}
        >
          <p className="text-[10.5px] font-bold text-navy leading-tight">
            {isSaving ? "חיסכון" : isGap ? "פער" : "השוואה"}
          </p>
          <div className="flex items-baseline gap-1.5 mt-1">
            {isSaving ? (
              <TrendingDown className="w-3.5 h-3.5 text-green-600 shrink-0" />
            ) : isGap ? (
              <TrendingUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : null}
            <p
              className={clsx(
                "text-[15px] font-bold tabular-nums leading-none",
                isSaving ? "text-green-700" : isGap ? "text-amber-700" : "text-slate-700",
              )}
            >
              {fmtPrice(Math.abs(savings.amount))}
            </p>
            {savings.percent != null && savings.amount !== 0 && (
              <span
                className={clsx(
                  "text-[10px] font-semibold tabular-nums",
                  isSaving ? "text-green-700" : "text-amber-700",
                )}
              >
                {isSaving ? "−" : "+"}
                {Math.abs(savings.percent).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            <MiniChip label="מזרח" value={east.east_selected_lines} tone="amber" />
            <span className="inline-flex items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] text-amber-800">
              <Lock className="w-2.5 h-2.5" /> פנימי
            </span>
          </div>
        </div>
      </div>

      {summary && (
        <p
          className={clsx(
            "flex items-center gap-1 text-[9px] leading-snug px-0.5",
            hasGap ? "text-amber-800" : "text-slate-500",
          )}
        >
          {hasGap && <AlertTriangle className="h-3 w-3 shrink-0" />}
          <span>
            סכום פעיל ({activeUnit ?? "—"}/יח׳): רק שורות עם מחיר — לא כולל
            {excludedNoSolution > 0 ? ` ${excludedNoSolution} ללא מחיר` : ""}
            {excludedDnp > 0 ? ` · ${excludedDnp} DNP` : ""}.
            {summary.has_solution > 0
              ? ` ${summary.has_solution}/${summary.total_lines} שורות בסכום.`
              : ""}
          </span>
        </p>
      )}
    </div>
  );
}
