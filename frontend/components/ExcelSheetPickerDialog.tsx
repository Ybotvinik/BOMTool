"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  fileName: string;
  sheetNames: string[];
  defaultSheet: string;
  busy?: boolean;
  title?: string;
  onConfirm: (sheetName: string) => void;
  onCancel: () => void;
};

export function ExcelSheetPickerDialog({
  open,
  fileName,
  sheetNames,
  defaultSheet,
  busy = false,
  title = "בחירת גליון (טאב) מהקובץ",
  onConfirm,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState(defaultSheet);

  useEffect(() => {
    if (open) setSelected(defaultSheet);
  }, [open, defaultSheet]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-picker-title"
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="sheet-picker-title" className="text-[14px] font-semibold text-slate-900">
            {title}
          </h2>
          <p className="text-[11.5px] text-slate-500 mt-1">
            בקובץ יש {sheetNames.length} גליונות. בחר מאיזה גליון לייבא את הנתונים.
          </p>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-2 text-[12px] text-slate-600">
            <FileSpreadsheet className="h-4 w-4 text-brand shrink-0" />
            <span className="truncate font-medium">{fileName}</span>
          </div>

          <div>
            <label className="block text-[12px] text-slate-600 mb-1.5">גליון (Sheet / Tab)</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={busy}
              className="w-full h-9 rounded-md border border-slate-200 px-2.5 text-[12.5px] bg-white"
            >
              {sheetNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {s === defaultSheet ? " (ברירת מחדל)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-8 px-3 rounded-md border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            disabled={busy || !selected}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-white text-[12px] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            המשך עם הגליון הנבחר
          </button>
        </div>
      </div>
    </div>
  );
}
