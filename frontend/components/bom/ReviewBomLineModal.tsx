"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import type { QualityLine } from "@/components/EditBomLineModal";

export function ReviewBomLineModal({
  line,
  onClose,
  onSaved,
}: {
  line: QualityLine;
  onClose: () => void;
  onSaved: (line: QualityLine, summary: Record<string, unknown> | null) => void;
}) {
  const { user } = useCurrentUser();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPost<{ line: QualityLine; quality_summary: Record<string, unknown> }>(
        `/api/bom-lines/${line.line_id}/quality-review`,
        { note: note.trim() || null },
        user.id,
      );
      onSaved(res.line, res.quality_summary ?? null);
    } catch (e) {
      setErr(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div dir="rtl" className="w-full max-w-md rounded-lg bg-white shadow-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 text-[14px] font-semibold text-navy">
          סמן כנבדק — שורה #{line.line_number}
        </div>
        <div className="p-4 space-y-3">
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
              {err}
            </div>
          )}
          <p className="text-[12px] text-slate-600 leading-relaxed">
            אישור ללא שינוי: הבעיה נבדקה ואינה דורשת תיקון נתונים. השורה תוסר מרשימת &quot;דורש
            טיפול&quot; ותישמר כנבדקה.
          </p>
          {line.review_reason && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
              {line.review_reason}
            </div>
          )}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1">הערת בדיקה (אופציונלי)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12.5px]"
              placeholder="למשל: נבדק מול דatasheet — יצרן לא נדרש"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? "שומר..." : "אשר ללא שינוי"}
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
