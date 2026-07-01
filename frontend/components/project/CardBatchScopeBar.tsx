"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Loader2, Save } from "lucide-react";
import { Card } from "@/components/ui";
import { formatBatchLabel, type ProjectOverviewContext } from "@/lib/project-overview";

type ProjectOption = { id: number; name: string };

type Props = {
  overview: ProjectOverviewContext | null;
  cardId: number | null;
  versionId: number | null;
  loading?: boolean;
  onCardChange: (cardId: number) => void;
  onBatchChange: (versionId: number) => void;
  variant?: "card" | "inline";
  projects?: ProjectOption[];
  projectId?: number | null;
  onProjectChange?: (projectId: number) => void;
  buildQuantity?: number | null;
  cardDefaultQuantity?: number | null;
  onSaveBuildQuantity?: (qty: number) => Promise<void>;
  savingQty?: boolean;
};

const inp =
  "h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white min-w-0 w-full";
const inpInline =
  "h-7 rounded-md border border-slate-200 px-2 text-[11px] bg-white min-w-[120px] flex-1 max-w-[200px]";

export function CardBatchScopeBar({
  overview,
  cardId,
  versionId,
  loading = false,
  onCardChange,
  onBatchChange,
  variant = "card",
  projects,
  projectId,
  onProjectChange,
  buildQuantity,
  cardDefaultQuantity,
  onSaveBuildQuantity,
  savingQty = false,
}: Props) {
  const selectedCard = overview?.cards.find((c) => c.id === cardId) ?? null;
  const isInline = variant === "inline";
  const showBuildQty = onSaveBuildQuantity != null;
  const showProject = projects != null && onProjectChange != null;

  const [qtyDraft, setQtyDraft] = useState(
    String(buildQuantity ?? cardDefaultQuantity ?? 1),
  );

  useEffect(() => {
    setQtyDraft(String(buildQuantity ?? cardDefaultQuantity ?? 1));
  }, [buildQuantity, cardDefaultQuantity, versionId]);

  async function saveQty() {
    if (!onSaveBuildQuantity) return;
    const n = Number(qtyDraft);
    if (!Number.isFinite(n) || n <= 0) return;
    await onSaveBuildQuantity(n);
  }

  const fieldInp = isInline ? inpInline : inp;

  const projectSelect = showProject ? (
    <select
      className={fieldInp}
      title="פרויקט"
      value={projectId ?? ""}
      onChange={(e) => {
        const id = Number(e.target.value);
        if (Number.isFinite(id)) onProjectChange(id);
      }}
      disabled={!projects?.length || loading}
    >
      {projects?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  ) : null;

  const cardSelect = (
    <select
      className={fieldInp}
      title="כרטיס"
      value={cardId ?? ""}
      onChange={(e) => {
        const id = Number(e.target.value);
        if (Number.isFinite(id)) onCardChange(id);
      }}
      disabled={!overview?.cards.length || loading}
    >
      {!overview?.cards.length ? (
        <option value="">אין כרטיסים</option>
      ) : (
        overview.cards.map((card) => (
          <option key={card.id} value={card.id}>
            {card.name}
            {card.board_name ? ` · ${card.board_name}` : ""}
            {card.build_quantity ? ` · ברירת מחדל ${card.build_quantity.toLocaleString()}` : ""}
          </option>
        ))
      )}
    </select>
  );

  const batchSelect = (
    <select
      className={fieldInp}
      title="מנה"
      value={versionId ?? ""}
      onChange={(e) => {
        const id = Number(e.target.value);
        if (Number.isFinite(id)) onBatchChange(id);
      }}
      disabled={!selectedCard?.batches.length || loading}
    >
      {!selectedCard?.batches.length ? (
        <option value="">אין מנות</option>
      ) : (
        selectedCard.batches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {formatBatchLabel(batch)}
            {batch.build_quantity != null ? ` · ×${batch.build_quantity.toLocaleString()}` : ""}
            {batch.is_project_active ? " ★" : ""}
            {batch.bom_items_count ? ` · ${batch.bom_items_count} פריטים` : ""}
          </option>
        ))
      )}
    </select>
  );

  const buildQtyField = showBuildQty ? (
    <div className="flex gap-1.5">
      <input
        type="number"
        min={1}
        className={clsx(fieldInp, "flex-1")}
        value={qtyDraft}
        disabled={versionId == null || savingQty || loading}
        onChange={(e) => setQtyDraft(e.target.value)}
        title="כמות יחידות להרכבה במנה זו"
      />
      <button
        type="button"
        disabled={versionId == null || savingQty || loading}
        onClick={() => void saveQty()}
        className={clsx(
          "px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90 disabled:opacity-50 inline-flex items-center gap-1 shrink-0",
          isInline ? "h-7 text-[11px] px-2" : "h-9",
        )}
      >
        {savingQty ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        שמור
      </button>
    </div>
  ) : null;

  if (isInline) {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap min-w-0">
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 shrink-0" />}
        {projectSelect}
        {cardSelect}
        {batchSelect}
        {buildQtyField}
      </div>
    );
  }

  const colCount = 2 + (showProject ? 1 : 0) + (showBuildQty ? 1 : 0);
  const gridClass =
    colCount >= 4
      ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
      : colCount === 3
        ? "grid-cols-1 md:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2";

  return (
    <Card className="p-3 mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-right min-w-0">
          <p className="text-[10px] font-semibold text-brand tracking-wide">הקשר צפייה</p>
          {overview ? (
            <p className="text-[12px] text-slate-600 mt-0.5">
              לקוח: <strong className="text-slate-800">{overview.customer_name}</strong>
              <span className="mx-2 text-slate-300">|</span>
              פרויקט: <strong className="text-slate-800">{overview.project_name}</strong>
              <span className="font-mono text-[11px] text-slate-500 mr-1">({overview.project_code})</span>
            </p>
          ) : (
            <p className="text-[12px] text-slate-500 mt-0.5">טוען פרויקט…</p>
          )}
          {showBuildQty && selectedCard && (
            <p className="text-[10px] text-slate-500 mt-1">
              כמות ברירת מחדל לכרטיס «{selectedCard.name}»:{" "}
              <strong className="text-slate-700">
                {(cardDefaultQuantity ?? selectedCard.build_quantity).toLocaleString()}
              </strong>
              {" · "}
              שינוי כמות המנה מעדכן Req Qty ומחיר מורחב בטבלה
            </p>
          )}
        </div>
        {loading && (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> טוען…
          </span>
        )}
      </div>
      <div className={clsx("grid gap-2", gridClass)}>
        {showProject && <Field label="פרויקט">{projectSelect}</Field>}
        <Field label="כרטיס">{cardSelect}</Field>
        <Field label="מנה (הרצת ייצור)">{batchSelect}</Field>
        {showBuildQty && (
          <Field
            label="כמות להרכבה (מנה)"
            hint={
              buildQuantity != null
                ? `מוגדר כעת: ${buildQuantity.toLocaleString()} יחידות`
                : undefined
            }
          >
            {buildQtyField}
          </Field>
        )}
      </div>
    </Card>
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
