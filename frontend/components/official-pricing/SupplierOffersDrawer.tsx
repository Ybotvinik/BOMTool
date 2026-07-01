"use client";

import clsx from "clsx";
import { X, ExternalLink, Lock, Star, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui";
import { fmtPrice, type SupplierOffer, type WorkbenchLine } from "./types";

type Props = {
  line: WorkbenchLine | null;
  includeEast: boolean;
  fetchingSupplier: string | null;
  fetchingAll?: boolean;
  onClose: () => void;
  onSelectSupplier: (supplier: string, needsReview: boolean, internalOnly?: boolean) => void;
  onFetchSupplier: (supplier: string) => void;
  onFetchAllSuppliers: () => void;
  onSelectTbd: () => void;
  onSelectDnp: () => void;
  onOpenManual: () => void;
};

function fmtDelta(v: number | null | undefined, currency = "USD") {
  if (v == null || v === 0) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${fmtPrice(v, currency)}`;
}

function needsFetch(offer: SupplierOffer): boolean {
  if (offer.internal_only) return false;
  if (offer.unit_price != null && offer.is_exact_match) return false;
  const st = offer.match_status ?? "";
  return (
    offer.unit_price == null ||
    st === "error" ||
    st === "not_found" ||
    st === "not_fetched"
  );
}

function MatchBadge({ offer }: { offer: SupplierOffer }) {
  const st = offer.match_status ?? "";
  if (st === "error") {
    return <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px]">שגיאה</Badge>;
  }
  if (st === "not_fetched") {
    return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[9px]">לא נמשך</Badge>;
  }
  if (st === "not_found") {
    return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[9px]">לא נמצא</Badge>;
  }
  if (offer.needs_review) {
    return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px]">Possible</Badge>;
  }
  if (offer.is_exact_match) {
    return <Badge className="bg-green-50 text-green-700 border-green-200 text-[9px]">Exact</Badge>;
  }
  return <Badge className="bg-slate-100 text-slate-600 text-[9px]">{st || "—"}</Badge>;
}

function OfferCard({
  offer,
  onSelect,
  onFetch,
  fetching,
  disabled,
}: {
  offer: SupplierOffer;
  onSelect: () => void;
  onFetch?: () => void;
  fetching?: boolean;
  disabled?: boolean;
}) {
  const selected = offer.is_currently_selected;
  const recommended = offer.is_recommended;
  const showFetch = onFetch && (needsFetch(offer) || offer.unit_price == null);
  const canSelect = offer.unit_price != null && !offer.disabled_in_current_mode;

  return (
    <div
      className={clsx(
        "rounded-lg p-3 text-[12px] border-2 transition-colors",
        selected
          ? "border-brand bg-brand/5"
          : recommended
            ? "border-green-300 bg-green-50/40"
            : offer.match_status === "error"
              ? "border-red-200 bg-red-50/30"
              : offer.disabled_in_current_mode
                ? "border-slate-100 bg-slate-50/80 opacity-80"
                : "border-slate-200 bg-white",
      )}
    >
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold">{offer.supplier_display}</span>
          {offer.internal_only && (
            <>
              <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[9px]">פנימי</Badge>
              <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[9px]">מזרח</Badge>
            </>
          )}
          {selected && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-brand font-semibold">
              <CheckCircle2 className="w-3 h-3" /> נבחר כרגע
            </span>
          )}
          {recommended && !selected && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-green-700 font-semibold">
              <Star className="w-3 h-3" /> מומלץ לפי מצב התמחור
            </span>
          )}
        </div>
        <MatchBadge offer={offer} />
      </div>

      {offer.disabled_reason && (
        <p className="text-[10px] text-amber-700 mb-2 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          {offer.disabled_reason}
        </p>
      )}

      {offer.match_status === "error" && offer.match_reason && (
        <p className="text-[10px] text-red-700 mb-2 leading-snug break-words">{offer.match_reason}</p>
      )}

      {offer.unit_price != null ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
          {offer.internal_only ? (
            <>
              <span className="col-span-2">
                מק״ט יצרן:{" "}
                <span className="font-mono text-[11px] text-slate-800">
                  {offer.matched_mpn ?? offer.mpn ?? "—"}
                </span>
              </span>
              <span className="col-span-2">
                מק״ט ספק:{" "}
                <span className="font-mono text-[11px] text-slate-800">
                  {offer.supplier_part_number ?? "—"}
                </span>
              </span>
            </>
          ) : (
            <span>
              PN: <span className="font-mono text-[11px]">{offer.supplier_part_number ?? "—"}</span>
            </span>
          )}
          <span>
            Unit: <strong className="text-slate-800">{fmtPrice(offer.unit_price, offer.currency)}</strong>
          </span>
          <span>
            Ext: <strong className="text-slate-800">{fmtPrice(offer.extended_price, offer.currency)}</strong>
          </span>
          <span>Stock: {offer.stock ?? "—"}</span>
          <span>Break: {offer.price_break_qty ?? "—"}</span>
          <span>Lead: {offer.lead_time ?? "—"}</span>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 mb-1">
          {offer.match_reason ?? "אין מחיר — נסה משיכה ידנית לספק זה"}
        </p>
      )}

      {offer.unit_price != null && (
        <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-1 text-[10px]">
          <span className="text-slate-500">
            Δ מול נבחר:{" "}
            <span
              className={clsx(
                "font-medium tabular-nums",
                (offer.delta_vs_selected ?? 0) < 0 ? "text-green-700" : (offer.delta_vs_selected ?? 0) > 0 ? "text-red-600" : "text-slate-600",
              )}
            >
              {fmtDelta(offer.delta_vs_selected, offer.currency)}
            </span>
          </span>
          <span className="text-slate-500">
            Δ מול רשמי:{" "}
            <span className="font-medium tabular-nums text-slate-700">
              {fmtDelta(offer.delta_vs_official_best, offer.currency)}
            </span>
          </span>
          {offer.savings_vs_official != null && offer.savings_vs_official > 0 && (
            <span className="col-span-2 text-green-700 font-medium">
              חיסכון מול מחיר רשמי: {fmtPrice(offer.savings_vs_official, offer.currency)}
            </span>
          )}
        </div>
      )}

      {offer.comments && <p className="text-[10px] text-slate-500 mt-1.5">{offer.comments}</p>}
      {offer.match_reason && offer.match_status !== "error" && (
        <p className="text-[10px] text-slate-400 mt-0.5">{offer.match_reason}</p>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {showFetch && (
          <button
            type="button"
            disabled={disabled || fetching}
            onClick={onFetch}
            className="inline-flex items-center gap-1 h-7 px-3 rounded-md border border-brand/30 bg-brand/5 text-brand text-[11px] hover:bg-brand/10 disabled:opacity-40"
          >
            {fetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            משוך מחיר
          </button>
        )}
        <button
          type="button"
          disabled={disabled || !canSelect}
          onClick={onSelect}
          className="h-7 px-3 rounded-md bg-brand text-white text-[11px] hover:bg-brand/90 disabled:opacity-40"
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
  );
}

export function SupplierOffersDrawer({
  line,
  includeEast,
  fetchingSupplier,
  fetchingAll = false,
  onClose,
  onSelectSupplier,
  onFetchSupplier,
  onFetchAllSuppliers,
  onSelectTbd,
  onSelectDnp,
  onOpenManual,
}: Props) {
  if (!line) return null;

  const apiOffers = line.offers.filter((o) => !o.internal_only);
  const eastOffers = line.offers.filter((o) => o.internal_only);
  const lp = line.line_pricing;
  const anyFetchable = apiOffers.some((o) => needsFetch(o));

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative w-full max-w-xl bg-white border-s border-slate-200 shadow-xl flex flex-col h-full ms-auto">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-navy">השוואת הצעות ספק</h2>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">{line.mpn ?? "—"}</p>
              {line.search_mpn_override_active && line.search_mpn && (
                <p className="text-[10px] text-amber-600 mt-0.5">חיפוש: {line.search_mpn}</p>
              )}
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-slate-100 flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </div>
          {line.source === "TBD" && anyFetchable && (
            <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
              אין מחיר נבחר — משיכה מרוכזת עלולה להיכשל (למשל rate limit). נסה «משוך מחיר» לספק בודד.
            </p>
          )}
          {lp && (
            <div className="mt-2 grid grid-cols-3 gap-2 rounded-md bg-slate-50 border border-slate-100 p-2 text-[10px]">
              <div>
                <p className="text-slate-500">מחיר רשמי מיטבי</p>
                <p className="font-bold tabular-nums">
                  {lp.has_official_price ? fmtPrice(lp.official_best_extended) : "אין מחיר רשמי"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">מחיר מזרח מיטבי</p>
                <p className="font-bold tabular-nums text-amber-800">
                  {lp.has_east_price ? fmtPrice(lp.east_best_extended) : "אין מחיר מזרח"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">פער רשמי − מזרח</p>
                <p
                  className={clsx(
                    "font-bold tabular-nums",
                    (lp.difference ?? 0) > 0 ? "text-green-700" : (lp.difference ?? 0) < 0 ? "text-amber-700" : "text-slate-700",
                  )}
                >
                  {lp.difference != null ? fmtPrice(lp.difference) : "—"}
                  {lp.difference_percent != null && (
                    <span className="text-[9px] font-normal ms-1">({lp.difference_percent.toFixed(1)}%)</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <section>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-semibold text-slate-600">א. מחירי API רשמיים</p>
              {apiOffers.length > 0 && (
                <button
                  type="button"
                  disabled={fetchingAll || fetchingSupplier != null}
                  onClick={onFetchAllSuppliers}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded border border-slate-200 text-[10px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  {fetchingAll ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  משוך את כולם
                </button>
              )}
            </div>
            {apiOffers.length === 0 ? (
              <p className="text-[11px] text-slate-400">אין ספקי API — בדוק הגדרות</p>
            ) : (
              <div className="space-y-3">
                {apiOffers.map((offer) => (
                  <OfferCard
                    key={offer.supplier}
                    offer={offer}
                    fetching={fetchingSupplier === offer.supplier}
                    onFetch={() => onFetchSupplier(offer.supplier)}
                    onSelect={() => onSelectSupplier(offer.supplier, offer.needs_review, false)}
                  />
                ))}
              </div>
            )}
          </section>

          {eastOffers.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold text-slate-600 mb-2">ב. מחירי מזרח / פנימי</p>
              <div className="space-y-3">
                {eastOffers.map((offer) => (
                  <OfferCard
                    key={`${offer.supplier}-${offer.supplier_part_number}`}
                    offer={offer}
                    disabled={!includeEast}
                    onSelect={() => onSelectSupplier(offer.supplier, offer.needs_review, true)}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <p className="text-[11px] font-semibold text-slate-600 mb-2">ג. ידני / חריג</p>
            <div className="space-y-2">
              <button type="button" onClick={onOpenManual} className="w-full h-8 rounded-md border border-slate-200 text-[12px] hover:bg-slate-50">
                Manual — הזנה ידנית
              </button>
              <button type="button" onClick={onSelectTbd} className="w-full h-8 rounded-md border border-slate-200 text-[12px] hover:bg-slate-50">
                TBD — ללא מקור (רק אם באמת אין מחיר)
              </button>
              <button type="button" onClick={onSelectDnp} className="w-full h-8 rounded-md border border-slate-200 text-[12px] hover:bg-slate-50">
                DNP
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
