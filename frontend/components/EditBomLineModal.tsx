"use client";

import { useState } from "react";
import { apiPatch } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

export type QualityLine = {
  line_id: number;
  line_number: number | null;
  original_mpn: string | null;
  uploaded_mpn?: string | null;
  cleaned_mpn: string | null;
  manufacturer: string | null;
  uploaded_manufacturer?: string | null;
  original_description: string | null;
  uploaded_description?: string | null;
  qty_per_assembly: number | null;
  uploaded_qty?: number | null;
  required_qty: number | null;
  reference_designators: string | null;
  footprint: string | null;
  value_text: string | null;
  is_dnp: boolean;
  uploaded_dnp?: boolean;
  quality_status: string;
  needs_review: boolean;
  review_reason: string | null;
  review_status?: string;
  quality_reviewed?: boolean;
  quality_review_note?: string | null;
  correction_note?: string | null;
  has_correction?: boolean;
  notes: string | null;
};

export function EditBomLineModal({
  line,
  onClose,
  onSaved,
}: {
  line: QualityLine;
  onClose: () => void;
  onSaved: (line: QualityLine, summary: Record<string, unknown> | null) => void;
}) {
  const { user } = useCurrentUser();
  const uploadedMpn = line.uploaded_mpn ?? line.original_mpn;
  const uploadedMfr = line.uploaded_manufacturer ?? line.manufacturer;
  const uploadedDesc = line.uploaded_description ?? line.original_description;
  const uploadedQty = line.uploaded_qty ?? line.qty_per_assembly;
  const uploadedDnp = line.uploaded_dnp ?? line.is_dnp;

  const [mpn, setMpn] = useState(line.original_mpn ?? "");
  const [mfr, setMfr] = useState(line.manufacturer ?? "");
  const [desc, setDesc] = useState(line.original_description ?? "");
  const [qty, setQty] = useState<string>(
    line.qty_per_assembly != null ? String(line.qty_per_assembly) : "",
  );
  const [dnp, setDnp] = useState(line.is_dnp);
  const [correctionNote, setCorrectionNote] = useState(line.correction_note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPatch<{ line: QualityLine; quality_summary: Record<string, unknown> }>(
        `/api/bom-lines/${line.line_id}/override`,
        {
          mpn,
          manufacturer: mfr,
          description: desc,
          quantity: qty === "" ? null : Number(qty),
          dnp,
          correction_note: correctionNote || null,
        },
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
      <div dir="rtl" className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 text-[14px] font-semibold text-navy">
          ערוך רכיב #{line.line_number}
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
              {err}
            </div>
          )}

          <div className="rounded-md border border-slate-100 bg-slate-50/80 p-2.5 text-[11px] space-y-1">
            <div className="font-medium text-slate-600 mb-1">ערכים מקוריים (מה-BOM שהועלה)</div>
            <ReadOnlyRow label="Original MPN" value={uploadedMpn} />
            <ReadOnlyRow label="Original Manufacturer" value={uploadedMfr} />
            <ReadOnlyRow label="Original Description" value={uploadedDesc} />
            <ReadOnlyRow label="Original Qty" value={uploadedQty != null ? String(uploadedQty) : null} />
            <ReadOnlyRow label="Original DNP" value={uploadedDnp ? "כן" : "לא"} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="MPN (תיקון)">
              <input value={mpn} onChange={(e) => setMpn(e.target.value)} className={inp} />
            </Field>
            <Field label="Manufacturer (תיקון)">
              <input value={mfr} onChange={(e) => setMfr(e.target.value)} className={inp} />
            </Field>
          </div>
          <Field label="Description (תיקון)">
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className={inp} />
          </Field>
          <Field label="Qty per Assembly (תיקון)">
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={inp}
            />
          </Field>
          <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
            <input type="checkbox" checked={dnp} onChange={(e) => setDnp(e.target.checked)} />
            DNP (Do Not Populate)
          </label>
          <Field label="הערת תיקון">
            <textarea
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              rows={2}
              className={inp}
              placeholder="למה בוצע התיקון?"
            />
          </Field>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? "שומר..." : "שמירת תיקון"}
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

const inp =
  "w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 shrink-0">{label}:</span>
      <span className="text-slate-700 truncate">{value || "—"}</span>
    </div>
  );
}
