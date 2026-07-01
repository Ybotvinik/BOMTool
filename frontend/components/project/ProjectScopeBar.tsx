"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Loader2, Save } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import type { OverviewCard, ProjectOverviewContext } from "@/lib/project-overview";
import { formatBatchLabel } from "@/lib/project-overview";

type Props = {
  overview: ProjectOverviewContext;
  cardId: number | null;
  versionId: number | null;
  buildQuantity: number | null;
  cardDefaultQuantity: number | null;
  onCardChange: (cardId: number) => void;
  onBatchChange: (versionId: number) => void;
  onSaveBuildQuantity: (qty: number) => Promise<void>;
  savingQty?: boolean;
};

export function ProjectScopeBar({
  overview,
  cardId,
  versionId,
  buildQuantity,
  cardDefaultQuantity,
  onCardChange,
  onBatchChange,
  onSaveBuildQuantity,
  savingQty = false,
}: Props) {
  const selectedCard = overview.cards.find((c) => c.id === cardId) ?? null;
  const [qtyDraft, setQtyDraft] = useState(
    String(buildQuantity ?? cardDefaultQuantity ?? 1),
  );

  useEffect(() => {
    setQtyDraft(String(buildQuantity ?? cardDefaultQuantity ?? 1));
  }, [buildQuantity, cardDefaultQuantity, versionId]);

  const inp =
    "h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white min-w-0 w-full";

  async function saveQty() {
    const n = Number(qtyDraft);
    if (!Number.isFinite(n) || n <= 0) return;
    await onSaveBuildQuantity(n);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-right min-w-0">
          <p className="text-[10px] font-semibold text-brand tracking-wide">הקשר צפייה</p>
          <p className="text-[12px] text-slate-600 mt-0.5">
            לקוח: <strong className="text-slate-800">{overview.customer_name}</strong>
            <span className="mx-2 text-slate-300">|</span>
            פרויקט: <strong className="text-slate-800">{overview.project_name}</strong>
            <span className="font-mono text-[11px] text-slate-500 mr-1">({overview.project_code})</span>
          </p>
        </div>
        <StatusBadge status={overview.project_status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Field label="כרטיס">
          <select
            className={inp}
            value={cardId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (Number.isFinite(id)) onCardChange(id);
            }}
            disabled={!overview.cards.length}
          >
            {!overview.cards.length ? (
              <option value="">אין כרטיסים</option>
            ) : (
              overview.cards.map((card: OverviewCard) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                  {card.board_name ? ` · ${card.board_name}` : ""}
                </option>
              ))
            )}
          </select>
        </Field>

        <Field label="מנה (הרצת ייצור)">
          <select
            className={inp}
            value={versionId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (Number.isFinite(id)) onBatchChange(id);
            }}
            disabled={!selectedCard?.batches.length}
          >
            {!selectedCard?.batches.length ? (
              <option value="">אין מנות לכרטיס</option>
            ) : (
              selectedCard.batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {formatBatchLabel(batch)}
                  {batch.is_project_active ? " ★" : ""}
                  {batch.bom_items_count ? ` · ${batch.bom_items_count} פריטים` : ""}
                </option>
              ))
            )}
          </select>
        </Field>

        <Field
          label="כמות להרכבה (מנה)"
          hint={
            cardDefaultQuantity != null
              ? `ברירת מחדל לכרטיס: ${cardDefaultQuantity.toLocaleString()}`
              : undefined
          }
        >
          <div className="flex gap-1.5">
            <input
              type="number"
              min={1}
              className={clsx(inp, "flex-1")}
              value={qtyDraft}
              disabled={versionId == null || savingQty}
              onChange={(e) => setQtyDraft(e.target.value)}
            />
            <button
              type="button"
              disabled={versionId == null || savingQty}
              onClick={() => void saveQty()}
              className="h-9 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90 disabled:opacity-50 inline-flex items-center gap-1 shrink-0"
            >
              {savingQty ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              שמור
            </button>
          </div>
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-right min-w-0">
      <label className="block text-[11px] text-slate-600 mb-1 font-medium">{label}</label>
      {children}
      {hint ? <p className="text-[10px] text-slate-400 mt-1">{hint}</p> : null}
    </div>
  );
}
