"use client";

import { X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui";
import { fmtPrice, type WorkbenchLine } from "./types";

type Props = {
  line: WorkbenchLine | null;
  onClose: () => void;
  onSelectSupplier: (supplier: string, needsReview: boolean) => void;
  onSelectTbd: () => void;
  onSelectDnp: () => void;
  onOpenManual: () => void;
};

export function SupplierOffersDrawer({
  line,
  onClose,
  onSelectSupplier,
  onSelectTbd,
  onSelectDnp,
  onOpenManual,
}: Props) {
  if (!line) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative w-full max-w-lg bg-white border-s border-slate-200 shadow-xl flex flex-col h-full ms-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <h2 className="text-[14px] font-bold text-navy">הצעות ספק</h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">{line.mpn ?? "—"}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-slate-100 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {line.offers.length === 0 && (
            <p className="text-[12px] text-slate-400 text-center py-8">אין הצעות ספק — משוך מחירים תחילה</p>
          )}

          {line.offers.map((offer) => (
            <div key={offer.supplier} className="border border-slate-200 rounded-lg p-3 text-[12px]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{offer.supplier_display}</span>
                {offer.needs_review ? (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200">Needs Review</Badge>
                ) : offer.is_exact_match ? (
                  <Badge className="bg-green-50 text-green-700 border-green-200">Exact</Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-600">{offer.match_status}</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
                <span>PN: <span className="font-mono text-[11px]">{offer.supplier_part_number ?? "—"}</span></span>
                <span>Unit: {fmtPrice(offer.unit_price, offer.currency)}</span>
                <span>Ext: {fmtPrice(offer.extended_price, offer.currency)}</span>
                <span>Stock: {offer.stock ?? "—"}</span>
                <span>Break: {offer.price_break_qty ?? "—"}</span>
                <span>Lead: {offer.lead_time ?? "—"}</span>
              </div>
              {offer.match_reason && (
                <p className="text-[10px] text-slate-400 mt-1">{offer.match_reason}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => onSelectSupplier(offer.supplier, offer.needs_review)}
                  className="h-7 px-3 rounded-md bg-brand text-white text-[11px] hover:bg-brand/90"
                >
                  בחר
                </button>
                {offer.product_url && (
                  <a
                    href={offer.product_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> מוצר
                  </a>
                )}
              </div>
            </div>
          ))}

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <p className="text-[11px] text-slate-500 font-medium">אפשרויות נוספות</p>
            <button type="button" onClick={onOpenManual} className="w-full h-8 rounded-md border border-slate-200 text-[12px] hover:bg-slate-50">
              Manual — הזנה ידנית
            </button>
            <button type="button" onClick={onSelectTbd} className="w-full h-8 rounded-md border border-slate-200 text-[12px] hover:bg-slate-50">
              TBD — ללא מקור
            </button>
            <button type="button" onClick={onSelectDnp} className="w-full h-8 rounded-md border border-slate-200 text-[12px] hover:bg-slate-50">
              DNP
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
