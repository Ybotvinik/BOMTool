"use client";

import { Card } from "@/components/ui";
import type { BomProjectMeta, BomSummary, BomVersionMeta } from "./types";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-slate-500">{label}: </span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "לא זמין";
  const d = iso.slice(0, 10);
  return d || "לא זמין";
}

function versionLabel(v: BomVersionMeta): string {
  const parts = [v.version_name ?? v.version_label];
  if (v.revision_code && !parts[0]?.includes(v.revision_code)) {
    parts.push(v.revision_code);
  }
  return parts.filter(Boolean).join(" · ") || "לא זמין";
}

export function BomContextHeader({
  project,
  customerName,
  version,
  summary,
  loading,
}: {
  project: BomProjectMeta | null;
  customerName: string | null;
  version: BomVersionMeta | null;
  summary: BomSummary | null;
  loading?: boolean;
}) {
  const total = summary?.total_lines ?? 0;
  const dnp = summary?.dnp_count ?? 0;
  const nonDnp = Math.max(0, total - dnp);

  return (
    <Card className="p-3 mb-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-navy">טבלת BOM</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            ניתוח איכות נתונים, חריגים ושורות BOM לפי גרסה נבחרת
          </p>
        </div>
        {loading && <span className="text-[11px] text-slate-400">טוען הקשר…</span>}
      </div>

      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-x-4 gap-y-1.5 text-[12px]">
        <MetaItem label="פרויקט" value={project?.name ?? "לא זמין"} />
        <MetaItem label="לקוח" value={customerName ?? "לא זמין"} />
        <MetaItem label="BOM Version" value={version ? versionLabel(version) : "לא זמין"} />
        <MetaItem
          label="BOM פעיל"
          value={version ? (version.is_active ? "כן" : "לא") : "לא זמין"}
        />
        <MetaItem label="שורות" value={summary ? String(total) : loading ? "…" : "לא זמין"} />
        <MetaItem label="DNP" value={summary ? String(dnp) : loading ? "…" : "לא זמין"} />
        <MetaItem label="לא-DNP" value={summary ? String(nonDnp) : loading ? "…" : "לא זמין"} />
        <MetaItem label="עודכן" value={version ? fmtDate(version.revised_date) : "לא זמין"} />
      </div>

      {version && (version.board_name || version.source_file_name) && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          {version.board_name && (
            <span>
              לוח: <span className="text-slate-700">{version.board_name}</span>
            </span>
          )}
          {version.source_file_name && (
            <span>
              קובץ: <span className="text-slate-700 font-mono">{version.source_file_name}</span>
            </span>
          )}
          {version.build_quantity != null && (
            <span>
              כמות הרכבה: <span className="text-slate-700">{version.build_quantity}</span>
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
