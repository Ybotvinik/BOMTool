"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import { Card } from "@/components/ui";
import { PricingComparisonCards } from "@/components/official-pricing/PricingComparisonCards";
import { fmtPrice, type PricingComparison } from "@/components/official-pricing/types";
import { apiGet } from "@/lib/api";

type CardProductionSummary = {
  card_id: number;
  card_name: string;
  board_name: string | null;
  bom_version_id: number | null;
  batch_label: string | null;
  build_quantity: number;
  bom_items_count: number;
  include_east_pricing: boolean;
  has_bom: boolean;
  pricing_comparison: PricingComparison | null;
  official_unit_cost: number | null;
  east_unit_cost: number | null;
  official_batch_total: number;
  east_batch_total: number;
  savings_amount: number;
  savings_percent: number | null;
};

type ProjectProductionSummary = {
  project_id: number;
  project_name: string;
  project_code: string;
  card_count: number;
  cards_with_bom: number;
  product_unit_official: number | null;
  product_unit_east: number | null;
  product_unit_savings: number | null;
  product_unit_savings_percent: number | null;
  batch_totals: PricingComparison;
  cards: CardProductionSummary[];
};

function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "brand";
}) {
  const toneClass = {
    default: "text-slate-900",
    good: "text-emerald-700",
    warn: "text-amber-700",
    brand: "text-brand",
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 min-w-0">
      <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
      <p className={clsx("text-[17px] font-bold tabular-nums leading-tight", toneClass)}>{value}</p>
      {sub ? <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}

export function ProjectProductionSummaryPanel({
  projectId,
  projectName,
}: {
  projectId: number | null;
  projectName?: string | null;
}) {
  const [data, setData] = useState<ProjectProductionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [unitsToProduce, setUnitsToProduce] = useState("");

  const load = useCallback(async () => {
    if (projectId == null) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<ProjectProductionSummary>(
        `/api/official-pricing/project-production-summary?project_id=${projectId}`,
      );
      setData(res);
    } catch (e) {
      setData(null);
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const minBuildQty = useMemo(() => {
    if (!data?.cards.length) return null;
    const qtys = data.cards.filter((c) => c.has_bom && c.build_quantity > 0).map((c) => c.build_quantity);
    return qtys.length ? Math.min(...qtys) : null;
  }, [data]);

  const profitCalc = useMemo(() => {
    const sell = Number(sellPrice);
    const units = Number(unitsToProduce);
    if (!data?.product_unit_east || !Number.isFinite(sell) || sell <= 0) return null;
    const costPerUnit = data.product_unit_east;
    const marginPerUnit = sell - costPerUnit;
    const marginPct = (marginPerUnit / sell) * 100;
    const batchUnits = Number.isFinite(units) && units > 0 ? units : minBuildQty;
    const batchRevenue = batchUnits != null && batchUnits > 0 ? sell * batchUnits : null;
    const batchCostEast = batchUnits != null && batchUnits > 0 ? costPerUnit * batchUnits : null;
    const batchProfit = batchRevenue != null && batchCostEast != null ? batchRevenue - batchCostEast : null;
    const officialCost =
      data.product_unit_official && batchUnits != null && batchUnits > 0
        ? data.product_unit_official * batchUnits
        : null;
    const savingsVsOfficial =
      officialCost != null && batchCostEast != null ? officialCost - batchCostEast : null;
    return {
      marginPerUnit,
      marginPct,
      batchUnits,
      batchRevenue,
      batchCostEast,
      batchProfit,
      savingsVsOfficial,
    };
  }, [data, sellPrice, unitsToProduce, minBuildQty]);

  if (projectId == null) {
    return (
      <Card className="p-4 text-[12px] text-slate-500">בחר פרויקט כדי לראות סיכום ייצור.</Card>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-h-0 overflow-auto pb-2">
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div>
          <p className="text-[12px] font-semibold text-navy">סיכום ייצור — {projectName ?? data?.project_name}</p>
          <p className="text-[10px] text-slate-500">
            השוואת עלות רכש רשמית מול משולב מזרח · לכל הכרטיסים בפרויקט
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 text-[11px] bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          רענון
        </button>
      </div>

      {error && (
        <div className="px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-800 text-[11px]">{error}</div>
      )}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-[12px] text-slate-500 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> טוען סיכום פרויקט…
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 shrink-0">
            <Kpi label="כרטיסים בפרויקט" value={String(data.card_count)} sub={`${data.cards_with_bom} עם BOM`} />
            <Kpi
              label="עלות מוצר — רשמי"
              value={fmtPrice(data.product_unit_official)}
              sub="סכום ליחידה (כל הכרטיסים)"
              tone="brand"
            />
            <Kpi
              label="עלות מוצר — משולב"
              value={fmtPrice(data.product_unit_east)}
              sub="רכש פנימי מזרח"
              tone="good"
            />
            <Kpi
              label="חיסכון ליחידה"
              value={fmtPrice(data.product_unit_savings)}
              sub={
                data.product_unit_savings_percent != null
                  ? `${data.product_unit_savings_percent.toFixed(1)}% מול רשמי`
                  : undefined
              }
              tone={(data.product_unit_savings ?? 0) > 0 ? "good" : "warn"}
            />
            <Kpi
              label="סה״כ רכש רשמי"
              value={fmtPrice(data.batch_totals.official_only.total)}
              sub="לכל המנות הפעילות"
            />
            <Kpi
              label="סה״כ רכש משולב"
              value={fmtPrice(data.batch_totals.with_east.total)}
              sub={`${data.batch_totals.with_east.east_selected_lines} שורות מזרח`}
              tone="good"
            />
          </div>

          <PricingComparisonCards
            comparison={data.batch_totals}
            activeModeEast
            summary={null}
          />

          <Card className="p-3 shrink-0 border-amber-200/80 bg-amber-50/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <p className="text-[11px] font-semibold text-amber-900">מחשבון רווח (פנימי)</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <div>
                <label className="text-[10px] text-slate-600">מחיר מכירה ליחידה (USD)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="mt-0.5 w-full h-8 rounded-md border border-slate-200 px-2 text-[12px]"
                  placeholder="לדוגמה 120"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-600">כמות ייצור לחישוב</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={unitsToProduce}
                  onChange={(e) => setUnitsToProduce(e.target.value)}
                  className="mt-0.5 w-full h-8 rounded-md border border-slate-200 px-2 text-[12px]"
                  placeholder={minBuildQty != null ? String(minBuildQty) : "כמות"}
                />
              </div>
              <div className="flex flex-col justify-end text-[10px] text-slate-500">
                {minBuildQty != null ? `מנה מינימלית בפרויקט: ${minBuildQty.toLocaleString()} יח׳` : null}
              </div>
            </div>
            {profitCalc ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Kpi
                  label="רווח גולמי ליחידה"
                  value={fmtPrice(profitCalc.marginPerUnit)}
                  sub={`${profitCalc.marginPct.toFixed(1)}% מחיר מכירה`}
                  tone={profitCalc.marginPerUnit >= 0 ? "good" : "warn"}
                />
                {profitCalc.batchProfit != null && profitCalc.batchUnits != null ? (
                  <>
                    <Kpi
                      label={`רווח למנה (×${profitCalc.batchUnits.toLocaleString()})`}
                      value={fmtPrice(profitCalc.batchProfit)}
                      tone={profitCalc.batchProfit >= 0 ? "good" : "warn"}
                    />
                    <Kpi label="הכנסה למנה" value={fmtPrice(profitCalc.batchRevenue)} />
                    <Kpi label="עלות רכש משולב" value={fmtPrice(profitCalc.batchCostEast)} tone="good" />
                  </>
                ) : null}
                {profitCalc.savingsVsOfficial != null && profitCalc.savingsVsOfficial > 0 ? (
                  <Kpi
                    label="חיסכון מול רכש רשמי"
                    value={fmtPrice(profitCalc.savingsVsOfficial)}
                    sub="למנה הנבחרת"
                    tone="good"
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">הזן מחיר מכירה כדי לחשב רווח גולמי.</p>
            )}
          </Card>

          <Card className="overflow-hidden shrink-0">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/60">
              <p className="text-[11px] font-semibold text-slate-800">פירוט לפי כרטיס</p>
              <p className="text-[9px] text-slate-500">
                מנה פעילה לכל כרטיס · לחץ לעריכת מחירון BOM
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="text-start px-3 py-2 font-medium">כרטיס</th>
                    <th className="text-start px-2 py-2 font-medium">מנה</th>
                    <th className="text-end px-2 py-2 font-medium">כמות</th>
                    <th className="text-end px-2 py-2 font-medium">רשמי/יח׳</th>
                    <th className="text-end px-2 py-2 font-medium">משולב/יח׳</th>
                    <th className="text-end px-2 py-2 font-medium">סה״כ רשמי</th>
                    <th className="text-end px-2 py-2 font-medium">סה״כ משולב</th>
                    <th className="text-end px-2 py-2 font-medium">חיסכון</th>
                    <th className="text-center px-2 py-2 font-medium w-10" />
                  </tr>
                </thead>
                <tbody>
                  {data.cards.map((card) => (
                    <CardRow key={card.card_id} card={card} projectId={data.project_id} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {data.cards_with_bom < data.card_count && (
            <p className="flex items-center gap-1 text-[10px] text-amber-800 px-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              חלק מהכרטיסים ללא BOM פעיל — הסיכום כולל רק כרטיסים עם מנה ופריטים.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

function CardRow({ card, projectId }: { card: CardProductionSummary; projectId: number }) {
  const saving = card.savings_amount > 0;
  const batchLabel =
    card.batch_label ||
    (card.bom_version_id != null ? `מנה #${card.bom_version_id}` : "—");

  return (
    <tr className={clsx("border-b border-slate-50", !card.has_bom && "opacity-60")}>
      <td className="px-3 py-2">
        <p className="font-medium text-slate-800">{card.card_name}</p>
        {card.board_name ? <p className="text-[9px] text-slate-400">{card.board_name}</p> : null}
      </td>
      <td className="px-2 py-2 text-slate-600 max-w-[140px] truncate" title={batchLabel}>
        {card.has_bom ? batchLabel : "אין BOM"}
      </td>
      <td className="px-2 py-2 text-end tabular-nums">
        {card.has_bom ? card.build_quantity.toLocaleString() : "—"}
      </td>
      <td className="px-2 py-2 text-end tabular-nums">{fmtPrice(card.official_unit_cost)}</td>
      <td className="px-2 py-2 text-end tabular-nums text-emerald-800">{fmtPrice(card.east_unit_cost)}</td>
      <td className="px-2 py-2 text-end tabular-nums">{fmtPrice(card.official_batch_total)}</td>
      <td className="px-2 py-2 text-end tabular-nums text-emerald-800">{fmtPrice(card.east_batch_total)}</td>
      <td className="px-2 py-2 text-end tabular-nums">
        {card.has_bom ? (
          <span className={clsx("inline-flex items-center gap-0.5", saving ? "text-green-700" : "text-amber-700")}>
            {saving ? <TrendingDown className="w-3 h-3" /> : card.savings_amount < 0 ? <TrendingUp className="w-3 h-3" /> : null}
            {fmtPrice(Math.abs(card.savings_amount))}
            {card.savings_percent != null && card.savings_amount !== 0 ? (
              <span className="text-[9px]">{saving ? "−" : "+"}{Math.abs(card.savings_percent).toFixed(1)}%</span>
            ) : null}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-2 py-2 text-center">
        {card.bom_version_id != null ? (
          <Link
            href={`/official-pricing?project_id=${projectId}&card_id=${card.card_id}&version_id=${card.bom_version_id}`}
            className="inline-flex text-brand hover:text-brand/80"
            title="פתח במחירון BOM"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        ) : null}
      </td>
    </tr>
  );
}
