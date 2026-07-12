"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ChevronLeft, Layers, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui";
import { fmtEastPrice, fmtPrice } from "@/components/official-pricing/types";
import { qualityScoreTone } from "@/components/bom/types";
import { apiGet } from "@/lib/api";

type CardRow = {
  card_id: number;
  card_name: string;
  board_name: string | null;
  bom_version_id: number | null;
  batch_label: string | null;
  build_quantity: number;
  bom_items_count: number;
  has_bom: boolean;
  has_east_pricing: boolean;
  official_unit_cost: number | null;
  official_batch_total: number;
  east_batch_total: number | null;
  savings_amount: number;
  bom_quality_score: number | null;
  bom_error_count: number;
  no_solution: number;
  needs_approval: number;
  no_stock: number;
  batch_selection: string;
};

type RollupData = {
  project_id: number;
  card_count: number;
  cards_with_bom: number;
  has_east_pricing: boolean;
  product_unit_official: number | null;
  product_unit_east: number | null;
  batch_totals: { official_only: { total: number } };
  project_totals: {
    bom_lines: number;
    bom_quality_score: number | null;
    bom_error_count: number;
    bom_needs_review_count: number;
    no_solution: number;
    needs_approval: number;
    no_stock: number;
    has_solution: number;
    cards_missing_bom: number;
  };
  cards: CardRow[];
};

function MiniKpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "bad" | "brand";
}) {
  const cls = {
    default: "text-slate-800",
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-red-700",
    brand: "text-brand",
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 min-w-0">
      <p className="text-[9.5px] text-slate-500">{label}</p>
      <p className={clsx("text-[15px] font-bold tabular-nums leading-tight", cls)}>{value}</p>
    </div>
  );
}

function batchSelectionLabel(sel: string) {
  if (sel === "active") return "כרטיס ראשי";
  if (sel === "project_active") return "כרטיס ראשי";
  if (sel === "latest") return "מנה אחרונה";
  return "—";
}

export function ProjectMultiCardSummary({
  projectId,
  currentCardId,
  onSelectCard,
}: {
  projectId: number;
  currentCardId?: number | null;
  onSelectCard?: (cardId: number, versionId: number | null) => void;
}) {
  const [data, setData] = useState<RollupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<RollupData>(
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

  if (loading && !data) {
    return (
      <Card className="p-4 flex items-center gap-2 text-[12px] text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> טוען סיכום מוצר…
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-3 text-[11px] text-red-700 border-red-200 bg-red-50">
        {error ?? "לא ניתן לטעון סיכום פרויקט"}
      </Card>
    );
  }

  const t = data.project_totals;
  const hasProblems =
    t.bom_error_count > 0 ||
    t.no_solution > 0 ||
    t.needs_approval > 0 ||
    t.no_stock > 0 ||
    t.cards_missing_bom > 0;
  const qTone = qualityScoreTone(t.bom_quality_score ?? 0);

  return (
    <Card className="overflow-hidden border-brand/20 shadow-sm">
      <div className="px-4 py-3 bg-gradient-to-l from-brand/5 to-white border-b border-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-brand">
              <Layers className="w-4 h-4" />
              <p className="text-[12px] font-bold text-navy">סיכום מוצר — כל הכרטיסים</p>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {data.card_count} כרטיסים · {data.cards_with_bom} עם BOM · סכום עלויות וסטטוס לכל הפרויקט
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 text-[10px] bg-white hover:bg-slate-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              רענון
            </button>
            <Link
              href={`/official-pricing?project_id=${projectId}&tab=production-summary`}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-brand text-white text-[10px] font-medium"
            >
              סיכום ייצור מלא
              <ChevronLeft className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 mt-3">
          <MiniKpi label="עלות מוצר/יח׳" value={fmtPrice(data.product_unit_official)} tone="brand" />
          <MiniKpi
            label="משולב/יח׳"
            value={fmtEastPrice(data.product_unit_east, data.has_east_pricing)}
            tone={data.has_east_pricing ? "good" : "warn"}
          />
          <MiniKpi label="סה״כ רכש רשמי" value={fmtPrice(data.batch_totals.official_only.total)} />
          <MiniKpi
            label="ציון איכות"
            value={t.bom_quality_score != null ? String(Math.round(t.bom_quality_score)) : "—"}
            tone={qTone === "good" ? "good" : qTone === "warn" ? "warn" : "bad"}
          />
          <MiniKpi label="שורות BOM" value={String(t.bom_lines)} />
          <MiniKpi
            label="אין פתרון"
            value={String(t.no_solution)}
            tone={t.no_solution > 0 ? "bad" : "default"}
          />
          <MiniKpi
            label="דורש אישור"
            value={String(t.needs_approval)}
            tone={t.needs_approval > 0 ? "warn" : "default"}
          />
          <MiniKpi
            label="אין מלאי"
            value={String(t.no_stock)}
            tone={t.no_stock > 0 ? "warn" : "default"}
          />
        </div>

        {hasProblems && (
          <p className="flex items-center gap-1 text-[10px] text-amber-800 mt-2">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {t.cards_missing_bom > 0 ? `${t.cards_missing_bom} כרטיסים ללא BOM · ` : ""}
            {t.bom_error_count > 0 ? `${t.bom_error_count} שגיאות איכות · ` : ""}
            {t.no_solution > 0 ? `${t.no_solution} שורות ללא מחיר · ` : ""}
            {t.needs_approval > 0 ? `${t.needs_approval} דורשות אישור` : ""}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/50">
              <th className="text-start px-3 py-2 font-medium">כרטיס</th>
              <th className="text-start px-2 py-2 font-medium">מנה</th>
              <th className="text-end px-2 py-2 font-medium">שורות</th>
              <th className="text-end px-2 py-2 font-medium">איכות</th>
              <th className="text-end px-2 py-2 font-medium">ללא מחיר</th>
              <th className="text-end px-2 py-2 font-medium">אישור</th>
              <th className="text-end px-2 py-2 font-medium">רשמי/יח׳</th>
              <th className="text-end px-2 py-2 font-medium">סה״כ רשמי</th>
              <th className="text-center px-2 py-2 font-medium w-16" />
            </tr>
          </thead>
          <tbody>
            {data.cards.map((card) => {
              const isCurrent = card.card_id === currentCardId;
              const batchLabel = card.batch_label ?? (card.bom_version_id ? `מנה #${card.bom_version_id}` : "—");
              const q = card.bom_quality_score;
              const qCls =
                q == null
                  ? "text-slate-400"
                  : qualityScoreTone(q) === "good"
                    ? "text-green-700"
                    : qualityScoreTone(q) === "warn"
                      ? "text-amber-700"
                      : "text-red-700";
              return (
                <tr
                  key={card.card_id}
                  className={clsx(
                    "border-b border-slate-50",
                    !card.has_bom && "opacity-60",
                    isCurrent && "bg-brand/5",
                  )}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{card.card_name}</p>
                    {card.board_name ? (
                      <p className="text-[9px] text-slate-400">{card.board_name}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-slate-600 max-w-[120px]">
                    {card.has_bom ? (
                      <>
                        <span className="truncate block" title={batchLabel}>
                          {batchLabel}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {batchSelectionLabel(card.batch_selection)}
                        </span>
                      </>
                    ) : (
                      "אין BOM"
                    )}
                  </td>
                  <td className="px-2 py-2 text-end tabular-nums">
                    {card.has_bom ? card.bom_items_count : "—"}
                  </td>
                  <td className={clsx("px-2 py-2 text-end tabular-nums font-medium", qCls)}>
                    {q != null ? Math.round(q) : "—"}
                  </td>
                  <td className="px-2 py-2 text-end tabular-nums text-red-700">
                    {card.has_bom && card.no_solution > 0 ? card.no_solution : "—"}
                  </td>
                  <td className="px-2 py-2 text-end tabular-nums text-amber-700">
                    {card.has_bom && card.needs_approval > 0 ? card.needs_approval : "—"}
                  </td>
                  <td className="px-2 py-2 text-end tabular-nums">{fmtPrice(card.official_unit_cost)}</td>
                  <td className="px-2 py-2 text-end tabular-nums font-medium">
                    {fmtPrice(card.official_batch_total)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {onSelectCard ? (
                      <button
                        type="button"
                        disabled={!card.has_bom}
                        onClick={() => onSelectCard(card.card_id, card.bom_version_id)}
                        className="text-[10px] text-brand hover:underline disabled:text-slate-300"
                      >
                        {isCurrent ? "נוכחי" : "פתח"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
