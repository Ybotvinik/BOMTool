"use client";

import { Loader2, Trash2 } from "lucide-react";

export type DeleteProjectDialogTarget = {
  projectId: number;
  projectName: string;
  projectCode: string;
  customerName: string;
  cardCount: number;
  batchCount: number;
  bomItemsCount: number;
};

type Props = {
  target: DeleteProjectDialogTarget;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteProjectDialog({
  target,
  busy = false,
  error = null,
  onClose,
  onConfirm,
}: Props) {
  const isEmpty =
    target.cardCount === 0 && target.batchCount === 0 && target.bomItemsCount === 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div dir="rtl" className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-red-100 bg-red-50/50">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <Trash2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-navy">מחיקת פרויקט</h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {target.customerName} · {target.projectCode}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
              {error}
            </div>
          )}

          <p className="text-[13px] text-slate-800 leading-relaxed">
            האם למחוק את הפרויקט <strong>«{target.projectName}»</strong>?
          </p>

          {isEmpty ? (
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 leading-relaxed">
              פרויקט זה ריק (ללא כרטיסים או מנות). מתאים למחיקה אם נוצר בטעות.
            </p>
          ) : (
            <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 leading-relaxed">
              לפרויקט זה יש {target.cardCount} כרטיסים, {target.batchCount} מנות ו-
              {target.bomItemsCount.toLocaleString()} פריטי BOM. הפרויקט יוסר מהרשימה אך הנתונים
              הקשורים יישמרו במערכת.
            </p>
          )}

          <p className="text-[11px] text-slate-500">האם אתה בטוח שברצונך להמשיך?</p>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-9 px-4 rounded-md bg-red-600 text-white text-[12.5px] font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            כן, מחק פרויקט
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] hover:bg-slate-50"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
