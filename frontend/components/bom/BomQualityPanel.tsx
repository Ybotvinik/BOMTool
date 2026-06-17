"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Card, Kpi } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type Summary = Record<string, number>;

export function BomQualityPanel({ versionId }: { versionId: number | null }) {
  const { user } = useCurrentUser();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      setSummary(await apiGet<Summary>(`/api/bom-versions/${id}/quality-summary`));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (versionId != null) load(versionId);
    else setSummary(null);
  }, [versionId, load]);

  async function reanalyze() {
    if (versionId == null) return;
    setBusy(true);
    try {
      await apiPost(`/api/bom-versions/${versionId}/reanalyze-quality`, {}, user.id);
      await load(versionId);
    } finally {
      setBusy(false);
    }
  }

  if (versionId == null) {
    return (
      <Card className="p-8 text-center text-slate-400 text-[13px]">
        בחר פרויקט וגרסת BOM לצפייה בניתוח איכות.
      </Card>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          onClick={reanalyze}
          disabled={busy || loading}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          נתח מחדש איכות BOM
        </button>
      </div>

      {loading ? (
        <Card className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
          <Loader2 className="h-4 w-4 animate-spin" /> טוען ניתוח איכות...
        </Card>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
          <Kpi
            label="Quality Score"
            value={summary?.quality_score ?? "—"}
            tone={(summary?.quality_score ?? 100) >= 90 ? "good" : (summary?.quality_score ?? 0) >= 70 ? "warn" : "bad"}
          />
          <Kpi label="Total" value={summary?.total_lines ?? 0} />
          <Kpi label="OK" value={summary?.ok_count ?? 0} tone="good" />
          <Kpi label="Warnings" value={summary?.warning_count ?? 0} tone="warn" />
          <Kpi label="Errors" value={summary?.error_count ?? 0} tone="bad" />
          <Kpi label="Needs Review" value={summary?.needs_review_count ?? 0} tone="warn" />
          <Kpi label="DNP" value={summary?.dnp_count ?? 0} />
          <Kpi label="Missing MPN" value={summary?.missing_mpn_count ?? 0} tone="bad" />
          <Kpi label="Missing Qty" value={summary?.missing_qty_count ?? 0} tone="bad" />
        </div>
      )}
    </>
  );
}
