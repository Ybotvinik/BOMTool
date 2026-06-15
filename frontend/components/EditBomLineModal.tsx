"use client";

import { useState } from "react";
import { apiPatch } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

export type QualityLine = {
  line_id: number;
  line_number: number | null;
  original_mpn: string | null;
  cleaned_mpn: string | null;
  manufacturer: string | null;
  original_description: string | null;
  qty_per_assembly: number | null;
  required_qty: number | null;
  reference_designators: string | null;
  footprint: string | null;
  value_text: string | null;
  is_dnp: boolean;
  quality_status: string;
  needs_review: boolean;
  review_reason: string | null;
  notes: string | null;
};

export function EditBomLineModal({
  line,
  onClose,
  onSaved,
}: {
  line: QualityLine;
  onClose: () => void;
  onSaved: (summary: Record<string, unknown> | null) => void;
}) {
  const { user } = useCurrentUser();
  const [mpn, setMpn] = useState(line.original_mpn ?? "");
  const [mfr, setMfr] = useState(line.manufacturer ?? "");
  const [desc, setDesc] = useState(line.original_description ?? "");
  const [qty, setQty] = useState<string>(
    line.qty_per_assembly != null ? String(line.qty_per_assembly) : "",
  );
  const [refdes, setRefdes] = useState(line.reference_designators ?? "");
  const [footprint, setFootprint] = useState(line.footprint ?? "");
  const [value, setValue] = useState(line.value_text ?? "");
  const [dnp, setDnp] = useState(line.is_dnp);
  const [notes, setNotes] = useState(line.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPatch<{ quality_summary: Record<string, unknown> }>(
        `/api/bom-lines/${line.line_id}`,
        {
          original_mpn: mpn,
          manufacturer: mfr,
          original_description: desc,
          qty_per_assembly: qty === "" ? null : Number(qty),
          reference_designators: refdes,
          footprint,
          value_text: value,
          is_dnp: dnp,
          notes,
        },
        user.id,
      );
      onSaved(res.quality_summary ?? null);
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
          עריכת שורת BOM #{line.line_number}
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="MPN">
              <input value={mpn} onChange={(e) => setMpn(e.target.value)} className={inp} />
            </Field>
            <Field label="Manufacturer">
              <input value={mfr} onChange={(e) => setMfr(e.target.value)} className={inp} />
            </Field>
          </div>
          <Field label="תיאור / Description">
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className={inp} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Qty per Assembly">
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={inp}
              />
            </Field>
            <Field label="Footprint">
              <input value={footprint} onChange={(e) => setFootprint(e.target.value)} className={inp} />
            </Field>
            <Field label="Value">
              <input value={value} onChange={(e) => setValue(e.target.value)} className={inp} />
            </Field>
          </div>
          <Field label="RefDes">
            <input value={refdes} onChange={(e) => setRefdes(e.target.value)} className={inp} />
          </Field>
          <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
            <input type="checkbox" checked={dnp} onChange={(e) => setDnp(e.target.checked)} />
            DNP (Do Not Populate)
          </label>
          <Field label="הערות / Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inp} />
          </Field>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? "שומר..." : "שמירה"}
          </button>
          <button
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
