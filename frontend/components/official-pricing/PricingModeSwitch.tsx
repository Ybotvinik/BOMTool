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

  const base =
    "flex-1 min-w-[140px] px-4 py-2.5 text-[12px] font-semibold rounded-lg border transition-all text-center";
  const active = "bg-brand text-white border-brand shadow-sm";
  const inactive = "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-2 shrink-0">
      <p className="text-[10px] font-semibold text-slate-500 mb-1.5 px-1">מצב תמחור</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={disabled || versionId == null}
          onClick={() => setMode(false)}
          className={clsx(base, !includeEast ? active : inactive)}
        >
          רשמי בלבד
          <span className="block text-[9px] font-normal opacity-80 mt-0.5">
            Digi-Key / Mouser / TI / Manual
          </span>
        </button>
        <button
          type="button"
          disabled={disabled || versionId == null}
          onClick={() => setMode(true)}
          className={clsx(base, includeEast ? active : inactive)}
        >
          משולב עם מחירי מזרח
          <span className="block text-[9px] font-normal opacity-80 mt-0.5">
            כולל Link / ספקי מזרח
          </span>
        </button>
      </div>
      <p className="text-[9px] text-slate-400 mt-1.5 px-1">
        {includeEast
          ? "מצב פעיל: מחירי מזרח משתתפים בבחירה ובסה״כ — פנימי בלבד"
          : "מצב פעיל: תמחור רשמי בלבד — ללא השפעת מחירי מזרח על הסה״כ"}
      </p>
    </div>
  );
}
