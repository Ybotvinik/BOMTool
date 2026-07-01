"use client";

import clsx from "clsx";
import { apiPatch } from "@/lib/api";

type Props = {
  includeEast: boolean;
  versionId: number | null;
  userId: number;
  onChange: (v: boolean) => void;
  onSaved: () => void;
  onError: (msg: string | null) => void;
  disabled?: boolean;
};

export function PricingModeSwitch({
  includeEast,
  versionId,
  userId,
  onChange,
  onSaved,
  onError,
  disabled,
}: Props) {
  async function setMode(east: boolean) {
    if (versionId == null || east === includeEast) return;
    onChange(east);
    try {
      await apiPatch(
        "/api/official-pricing/workbench/include-east-pricing",
        { bom_version_id: versionId, include_east_pricing: east },
        userId,
      );
      onSaved();
    } catch (e) {
      onChange(!east);
      onError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  const btn =
    "px-2.5 py-1 text-[10px] font-semibold rounded transition-colors disabled:opacity-50 whitespace-nowrap";

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      <span className="text-[9px] text-slate-500 font-medium">מצב:</span>
      <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
        <button
          type="button"
          disabled={disabled || versionId == null}
          onClick={() => setMode(false)}
          className={clsx(
            btn,
            !includeEast ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-white",
          )}
        >
          רשמי
        </button>
        <button
          type="button"
          disabled={disabled || versionId == null}
          onClick={() => setMode(true)}
          className={clsx(
            btn,
            includeEast ? "bg-amber-600 text-white shadow-sm" : "text-slate-600 hover:bg-white",
          )}
        >
          משולב מזרח
        </button>
      </div>
    </div>
  );
}
