"use client";

import { Loader2, Trash2 } from "lucide-react";

export type DeleteBatchDialogTarget = {
  batchId: number;
  batchLabel: string;
  cardName: string;
  projectName: string;
  bomItemsCount: number;
  isActiveBatch: boolean;
};

type Props = {
  target: DeleteBatchDialogTarget;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteBatchDialog({
  target,
  busy = false,
  error = null,
  onClose,
  onConfirm,
}: Props) {
  const isEmpty = target.bomItemsCount === 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div dir="rtl" className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-red-100 bg-red-50/50">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <Trash2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-navy">מחיקת מנה</h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {target.projectName} · {target.cardName}
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
            האם למחוק את המנה <strong>«{target.batchLabel}»</strong>?
          </p>

          {isEmpty ? (
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 leading-relaxed">
              מנה זו ריקה או לא הושלמה (ללא שורות BOM). מתאים למחיקה אם פתחת מנה ולא
              סיימת את התהליך.
            </p>
          ) : (
            <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 leading-relaxed">
              פעולה זו תמחק לצמיתות {target.bomItemsCount.toLocaleString()} פריטי BOM במנה
              זו. לא ניתן לשחזר.
            </p>
          )}

          {target.isActiveBatch && (
            <p className="text-[11px] text-slate-500">
              זו המנה הפעילה בפרויקט — לאחר המחיקה תיבחר אוטומטית מנה אחרת (אם קיימת).
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
            כן, מחק מנה
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
