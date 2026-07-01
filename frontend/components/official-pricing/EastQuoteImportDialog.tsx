"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Database, FileSpreadsheet, Loader2 } from "lucide-react";
import { apiEastQuoteImport, apiEastQuotePreview } from "@/lib/api";

export type EastQuotePreviewData = {
  file_path: string;
  file_name: string;
  sheet_name: string;
  sheet_names: string[];
  detected_header_row_index: number | null;
  header_row_index: number | null;
  columns: string[];
  rows: string[][];
  total_rows: number;
  candidate_header_rows: {
    row_index: number;
    values: string[];
    non_empty_count: number;
    keyword_hits: number;
  }[];
  suggested_mapping: Record<string, string | null>;
  warning: string | null;
};

type ImportResult = {
  quote_id: number;
  supplier_name: string;
  source_filename: string;
  lines_imported: number;
  match_summary: {
    matched_count?: number;
    exact_mpn?: number;
    designator_match?: number;
    not_found?: number;
    lines_total?: number;
  };
  include_east_pricing_enabled?: boolean;
};

const MAP_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "mpn", label: "MPN", required: true },
  { key: "unit_price", label: "מחיר יחידה", required: true },
  { key: "designator", label: "Designator" },
  { key: "quantity", label: "Quantity" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "description", label: "Description" },
  { key: "vendor", label: "Vendor / ספק" },
  { key: "supplier_part_number", label: "Supplier PN" },
  { key: "total_price", label: "Total" },
  { key: "quoted_qty", label: "Quoted Qty" },
  { key: "lead_time", label: "Lead Time" },
  { key: "assembly", label: "Assembly / DNP" },
];

const NONE = "__none__";

type Props = {
  open: boolean;
  file: File;
  projectId: number;
  versionId: number;
  userId: number;
  replaceExisting: boolean;
  replaceQuoteId: number | null;
  onClose: () => void;
  onImported: (result: ImportResult) => void;
  onError: (msg: string | null) => void;
};

export function EastQuoteImportDialog({
  open,
  file,
  projectId,
  versionId,
  userId,
  replaceExisting,
  replaceQuoteId,
  onClose,
  onImported,
  onError,
}: Props) {
  const [preview, setPreview] = useState<EastQuotePreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function loadPreview(opts?: { sheetName?: string; headerRowIndex?: number }) {
    setBusy(true);
    setLocalError(null);
    onError(null);
    try {
      const pv = await apiEastQuotePreview<EastQuotePreviewData>({
        file: preview ? undefined : file,
        filePath: preview?.file_path,
        sheetName: opts?.sheetName ?? preview?.sheet_name,
        headerRowIndex: opts?.headerRowIndex ?? preview?.header_row_index ?? undefined,
      });
      setPreview(pv);
      setMapping(pv.suggested_mapping);
    } catch (e) {
      const msg = String(e).replace(/^Error:\s*/, "");
      setLocalError(msg);
      onError(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setMapping({});
      setLocalError(null);
      return;
    }
    loadPreview().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file.name]);

  async function doImport() {
    if (!preview) return;
    if (!mapping.mpn || !mapping.unit_price) {
      setLocalError("חובה למפות לפחות MPN ומחיר יחידה");
      return;
    }
    if (preview.header_row_index == null) {
      setLocalError("יש לבחור שורת כותרות");
      return;
    }
    setBusy(true);
    setLocalError(null);
    onError(null);
    try {
      const res = await apiEastQuoteImport<ImportResult>(
        {
          project_id: projectId,
          bom_version_id: versionId,
          file_path: preview.file_path,
          sheet_name: preview.sheet_name,
          header_row_index: preview.header_row_index,
          column_mapping: mapping,
          replace_existing: replaceExisting,
          quote_id_to_replace: replaceExisting ? replaceQuoteId : null,
          enable_integrated_pricing: true,
        },
        userId,
      );
      onImported(res);
      onClose();
    } catch (e) {
      const msg = String(e).replace(/^Error:\s*/, "");
      setLocalError(msg);
      onError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl flex flex-col">
        <div className="border-b border-slate-100 px-4 py-3 shrink-0">
          <h2 className="text-[14px] font-semibold text-slate-900">ייבוא מחירי מזרח</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            בחר גליון, שורת כותרות ומיפוי עמודות — ואז ייבא לתמחור המשולב
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {preview && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
              <FileSpreadsheet className="h-4 w-4 text-brand shrink-0" />
              <span className="font-medium truncate">{preview.file_name}</span>
              <span className="text-slate-400">·</span>
              <span>{preview.total_rows} שורות בגליון</span>
            </div>
          )}

          {(localError || preview?.warning) && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 text-amber-900 text-[11px] px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{localError || preview?.warning}</span>
            </div>
          )}

          {preview && preview.sheet_names.length > 1 && (
            <div>
              <label className="block text-[11px] text-slate-600 mb-1">גליון (Sheet)</label>
              <select
                value={preview.sheet_name}
                disabled={busy}
                onChange={(e) => loadPreview({ sheetName: e.target.value })}
                className="w-full h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white"
              >
                {preview.sheet_names.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {preview && (
            <div className="rounded-md border border-slate-200 p-2.5 space-y-2">
              <p className="text-[11px] font-medium text-slate-700">שורת כותרות</p>
              <select
                value={preview.header_row_index ?? ""}
                disabled={busy}
                onChange={(e) => loadPreview({ headerRowIndex: Number(e.target.value) })}
                className="w-full h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white"
              >
                {preview.header_row_index == null && <option value="">— בחר שורה —</option>}
                {preview.candidate_header_rows.map((c) => (
                  <option key={c.row_index} value={c.row_index}>
                    שורה {c.row_index + 1}
                    {c.keyword_hits > 0 ? ` ★${c.keyword_hits}` : ""} —{" "}
                    {c.values.filter(Boolean).slice(0, 4).join(" | ")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {preview && preview.columns.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MAP_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[10.5px] text-slate-600 mb-0.5">
                      {f.label}
                      {f.required ? " *" : ""}
                    </label>
                    <select
                      value={mapping[f.key] ?? NONE}
                      disabled={busy}
                      onChange={(e) =>
                        setMapping((m) => ({
                          ...m,
                          [f.key]: e.target.value === NONE ? null : e.target.value,
                        }))
                      }
                      className="w-full h-8 rounded-md border border-slate-200 px-2 text-[11.5px] bg-white"
                    >
                      <option value={NONE}>— ללא —</option>
                      {preview.columns.filter(Boolean).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {preview.rows.length > 0 && (
                <div className="rounded-md border border-slate-200 overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead className="bg-slate-50">
                      <tr>
                        {preview.columns.map((c, i) => (
                          <th key={i} className="px-2 py-1 text-right font-medium text-slate-600 whitespace-nowrap">
                            {c || "—"}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 5).map((row, ri) => (
                        <tr key={ri} className="border-t border-slate-100">
                          {preview.columns.map((_, ci) => (
                            <td key={ci} className="px-2 py-1 text-slate-700 whitespace-nowrap max-w-[120px] truncate">
                              {row[ci] || ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {busy && !preview && (
            <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              טוען תצוגה מקדימה…
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-8 px-3 rounded-md border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={doImport}
            disabled={busy || !preview}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-white text-[12px] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            ייבא מחירי מזרח
          </button>
        </div>
      </div>
    </div>
  );
}
