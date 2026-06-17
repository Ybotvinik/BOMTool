"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, ShieldCheck } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { EditBomLineModal, type QualityLine } from "@/components/EditBomLineModal";

function SeverityBadge({ status }: { status: string }) {
  if (status === "error") return <Badge className="bg-red-50 text-risk-critical border-red-200">Error</Badge>;
  if (status === "warning") return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Warning</Badge>;
  return <Badge className="bg-green-50 text-risk-low border-green-200">OK</Badge>;
}

export function BomIssuesPanel({
  versionId,
  tabQuery,
}: {
  versionId: number | null;
  tabQuery?: Record<string, string | number | null | undefined>;
}) {
  const [issues, setIssues] = useState<QualityLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<QualityLine | null>(null);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      setIssues(await apiGet<QualityLine[]>(`/api/bom-versions/${id}/quality-issues`));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (versionId != null) load(versionId);
    else setIssues([]);
  }, [versionId, load]);

  function bomLineHref(lineId: number) {
    const params = new URLSearchParams();
    if (tabQuery) {
      for (const [key, value] of Object.entries(tabQuery)) {
        if (value != null && value !== "") params.set(key, String(value));
      }
    }
    params.set("tab", "lines");
    params.set("line_id", String(lineId));
    return `/bom?${params.toString()}`;
  }

  if (versionId == null) {
    return (
      <Card className="p-8 text-center text-slate-400 text-[13px]">
        בחר פרויקט וגרסת BOM לצפייה בחריגים ובעיות.
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
            <Loader2 className="h-4 w-4 animate-spin" /> טוען חריגים...
          </div>
        ) : issues.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-risk-low text-[13px]">
            <ShieldCheck className="h-7 w-7" /> אין חריגים או בעיות בגרסה זו.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-right">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Severity</th>
                  <th className="px-2 py-2 font-medium">Issue / Review Reason</th>
                  <th className="px-2 py-2 font-medium">MPN</th>
                  <th className="px-2 py-2 font-medium">Manufacturer</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium text-center">Qty</th>
                  <th className="px-2 py-2 font-medium">RefDes</th>
                  <th className="px-2 py-2 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((r) => (
                  <tr key={r.line_id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-2 py-1.5 text-slate-400 tabular-nums">{r.line_number}</td>
                    <td className="px-2 py-1.5"><SeverityBadge status={r.quality_status} /></td>
                    <td className="px-2 py-1.5 text-amber-700">{r.review_reason || "—"}</td>
                    <td className="px-2 py-1.5 font-medium tabular-nums">{r.original_mpn || "—"}</td>
                    <td className="px-2 py-1.5">{r.manufacturer || "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-[220px] truncate">{r.original_description || "—"}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{r.qty_per_assembly ?? "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-[140px] truncate">{r.reference_designators || "—"}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditing(r)}
                          title="עריכה"
                          className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-brand"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={bomLineHref(r.line_id)}
                          title="פתח בשורות BOM"
                          className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-brand text-[10px] font-medium"
                        >
                          BOM
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <EditBomLineModal
          line={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            if (versionId) load(versionId);
          }}
        />
      )}
    </>
  );
}
