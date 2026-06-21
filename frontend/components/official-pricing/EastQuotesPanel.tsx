"use client";

import { useRef, useState } from "react";
import { Archive, CheckCircle2, Loader2, Upload } from "lucide-react";
import { apiDelete, apiEastQuoteUpload, apiPatch } from "@/lib/api";

export type EastQuoteRow = {
  id: number;
  supplier_name: string;
  source_filename: string | null;
  sheet_name: string | null;
  board_name: string | null;
  doc_number: string | null;
  revised_date: string | null;
  is_active: boolean;
  status: string;
  lines_count: number;
  matched_count: number;
  total_price_summary: number | null;
  created_at: string | null;
};

type Props = {
  projectId: number | null;
  versionId: number | null;
  userId: number;
  quotes: EastQuoteRow[];
  onChanged: () => void;
  onError: (msg: string | null) => void;
};

export function EastQuotesPanel({ projectId, versionId, userId, quotes, onChanged, onError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [replaceQuoteId, setReplaceQuoteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const activeQuote = quotes.find((q) => q.is_active);

  async function upload(file: File) {
    if (projectId == null || versionId == null) return;
    setBusy(true);
    onError(null);
    try {
      await apiEastQuoteUpload({
        file,
        projectId,
        bomVersionId: versionId,
        replaceExisting,
        quoteIdToReplace: replaceExisting ? replaceQuoteId ?? undefined : undefined,
        userId,
      });
      onChanged();
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function activate(quoteId: number) {
    setBusy(true);
    onError(null);
    try {
      await apiPatch(`/api/official-pricing/east-quotes/${quoteId}/activate`, {}, userId);
      onChanged();
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function archive(quoteId: number) {
    if (!confirm("האם לארכב את הצעת המחיר הישנה? פעולה זו לא תשפיע על קובץ המקור של BOM.")) {
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await apiDelete(`/api/official-pricing/east-quotes/${quoteId}`, userId);
      onChanged();
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 text-[10.5px] bg-white hover:bg-slate-50 disabled:opacity-50";

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2 shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-semibold text-slate-600">העלאת מחירי מזרח</span>
        <span className="text-[9.5px] text-slate-500">שם הספק נלקח מהקובץ (עמודת Vendor)</span>
        {activeQuote && (
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-[10px]">
            <CheckCircle2 className="w-3 h-3 text-amber-600" />
            <span>
              <strong>{activeQuote.supplier_name}</strong>
              <span className="text-slate-500 mx-1">·</span>
              <span className="text-slate-600 truncate max-w-[160px] inline-block align-bottom" title={activeQuote.source_filename ?? ""}>
                {activeQuote.source_filename}
              </span>
              <span className="text-slate-400 mx-1">·</span>
              <span className="text-amber-800 font-medium">פעיל</span>
              <span className="text-slate-400 mx-1">·</span>
              <span className="tabular-nums">{activeQuote.matched_count}/{activeQuote.lines_count} matched</span>
            </span>
          </div>
        )}
        <label className="inline-flex items-center gap-1 text-[10px] text-slate-600">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
          />
          החלף קובץ קיים
        </label>
        {replaceExisting && quotes.length > 0 && (
          <select
            className="h-7 rounded-md border border-slate-200 px-1.5 text-[10.5px] bg-white max-w-[140px]"
            value={replaceQuoteId ?? ""}
            onChange={(e) => setReplaceQuoteId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">בחר הצעה</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.source_filename ?? q.id}
              </option>
            ))}
          </select>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <button
          type="button"
          className={btn}
          disabled={busy || projectId == null || versionId == null}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          טען הצעת ספק מזרח
        </button>
      </div>
      {quotes.length > 1 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {quotes
            .filter((q) => !q.is_active)
            .map((q) => (
              <div
                key={q.id}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-100 bg-slate-50 text-[9px] text-slate-500"
              >
                <span className="truncate max-w-[100px]" title={q.source_filename ?? ""}>
                  {q.source_filename}
                </span>
                <span className="tabular-nums">{q.matched_count}/{q.lines_count}</span>
                <button type="button" className="text-brand hover:underline" onClick={() => activate(q.id)}>
                  הפעל
                </button>
                <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => archive(q.id)}>
                  <Archive className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
