"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  UploadCloud,
  FileSpreadsheet,
  Table2,
  Database,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Rows3,
} from "lucide-react";
import { Card, PageHeader, Badge } from "@/components/ui";
import { apiGet, apiBomPreview, apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = { id: number; name: string; code: string; customer_id: number };
type ApiCustomer = { id: number; name: string };

type CandidateRow = {
  row_index: number;
  values: string[];
  non_empty_count: number;
  keyword_hits: number;
};

type ExtractedMetadata = {
  board_name: string | null;
  doc_number: string | null;
  revised_date: string | null;
  revision: string | null;
  bom_number: string | null;
  revision_code: string | null;
};

type Preview = {
  file_path: string;
  file_name: string;
  sheet_name: string;
  sheet_names: string[];
  detected_header_row_index: number | null;
  header_row_index: number | null;
  columns: string[];
  rows: string[][];
  total_rows: number;
  metadata_rows: string[][];
  candidate_header_rows: CandidateRow[];
  suggested_mapping: Record<string, string | null>;
  extracted_metadata: ExtractedMetadata;
  suggested_version_name: string;
  suggested_revision_code: string | null;
  warning: string | null;
};

type ImportResult = {
  success: boolean;
  bom_version_id: number;
  version_name: string;
  rows_imported: number;
  skipped_rows: number;
  missing_mpn_count: number;
  missing_qty_count: number;
  dnp_count: number;
  needs_review_count: number;
  project_id: number;
  total_rows_scanned: number;
  empty_rows_skipped: number;
  invalid_rows_skipped: number;
  rows_needing_review: number;
  skipped_rows_sample: string[];
};

const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "mpn", label: "MPN", required: true },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "description", label: "תיאור / Description" },
  { key: "quantity", label: "Qty per Assembly" },
  { key: "reference_designators", label: "Reference Designators" },
  { key: "footprint", label: "Footprint" },
  { key: "value", label: "Value" },
  { key: "supplier_part_number", label: "Supplier Part Number" },
  { key: "unit", label: "Unit" },
  { key: "customer_price", label: "Customer Price" },
  { key: "internal_cost", label: "Internal Cost" },
  { key: "is_critical", label: "Critical" },
  { key: "dnp", label: "Assembly / DNP" },
];

const NONE = "__none__";

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={
          "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold " +
          (done ? "bg-risk-low text-white" : active ? "bg-brand text-white" : "bg-slate-200 text-slate-500")
        }
      >
        {done ? "✓" : n}
      </div>
      <span className={"text-[12px] " + (active ? "font-semibold text-slate-800" : "text-slate-500")}>
        {label}
      </span>
    </div>
  );
}

function UploadBomInner() {
  const urlProjectId = useSearchParams().get("project_id");
  const { user } = useCurrentUser();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [setActive, setSetActive] = useState(true);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showMeta, setShowMeta] = useState(false);
  // Track manual edits so re-previews don't clobber a user-entered version name.
  const [versionEdited, setVersionEdited] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<ApiProject[]>("/api/projects"),
      apiGet<ApiCustomer[]>("/api/customers"),
    ])
      .then(([p, cs]) => {
        setProjects(p);
        setCustomers(cs);
        if (urlProjectId) {
          const match = p.find((x) => String(x.id) === String(urlProjectId));
          if (match) {
            setSelectedProjectId(String(match.id));
            setError(null);
          } else {
            setSelectedProjectId("");
            setError("הפרויקט שנבחר לא נמצא");
          }
        } else {
          setSelectedProjectId("");
        }
      })
      .catch(() => setError("לא ניתן לטעון פרויקטים — ודא שה-API פעיל."));
  }, [urlProjectId]);

  const selectedProject = projects.find((p) => String(p.id) === String(selectedProjectId));
  const canUpload = Boolean(selectedProjectId) && Boolean(selectedProject);
  const selectedCustomerName =
    selectedProject != null
      ? customers.find((c) => c.id === selectedProject.customer_id)?.name ?? "—"
      : null;

  function applyPreview(pv: Preview) {
    setPreview(pv);
    setMapping(pv.suggested_mapping);
    // Auto-fill the version name from the file unless the user edited it.
    if (!versionEdited && pv.suggested_version_name) {
      setVersionLabel(pv.suggested_version_name);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!canUpload) {
      setError("יש לבחור פרויקט לפני העלאת קובץ BOM");
      return;
    }
    const pid = Number(selectedProjectId);
    setError(null);
    setResult(null);
    setBusy(true);
    setVersionEdited(false);
    try {
      const pv = await apiBomPreview<Preview>({
        file,
        projectId: pid,
        userId: user.id,
      });
      applyPreview(pv);
    } catch (e) {
      setError(String(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  // Re-preview an already-uploaded file with a different header row / sheet.
  async function rePreview(opts: { headerRowIndex?: number; sheetName?: string }) {
    if (!preview || !canUpload) return;
    const pid = Number(selectedProjectId);
    setBusy(true);
    setError(null);
    try {
      const pv = await apiBomPreview<Preview>({
        filePath: preview.file_path,
        headerRowIndex: opts.headerRowIndex,
        sheetName: opts.sheetName ?? preview.sheet_name,
        projectId: pid,
        userId: user.id,
      });
      applyPreview(pv);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!preview || !canUpload) return;
    const pid = Number(selectedProjectId);
    if (preview.header_row_index == null) {
      setError("יש לבחור שורת כותרות לפני הייבוא.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<ImportResult>(
        "/api/bom-import/commit",
        {
          project_id: pid,
          version_name: versionLabel || preview.suggested_version_name,
          revision_code: preview.suggested_revision_code,
          extracted_metadata: preview.extracted_metadata,
          status: "In Review",
          source: "excel-import",
          file_path: preview.file_path,
          sheet_name: preview.sheet_name,
          header_row_index: preview.header_row_index,
          mapping,
          set_active: setActive,
        },
        user.id,
      );
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const step = result ? 4 : preview ? 3 : 1;
  const headerHuman = preview?.header_row_index != null ? preview.header_row_index + 1 : null;
  const detectedHuman =
    preview?.detected_header_row_index != null ? preview.detected_header_row_index + 1 : null;

  return (
    <>
      <PageHeader
        title="טעינת BOM"
        subtitle="העלאת קובץ Excel/CSV, זיהוי שורת כותרות, מיפוי עמודות וייבוא לבסיס הנתונים"
      />

      <Card className="p-3 mb-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <StepBadge n={1} label="העלאת קובץ" active={step === 1} done={step > 1} />
          <span className="text-slate-300">›</span>
          <StepBadge n={2} label="תצוגה מקדימה" active={step === 3 && !result} done={step > 1} />
          <span className="text-slate-300">›</span>
          <StepBadge n={3} label="מיפוי עמודות" active={step === 3 && !result} done={!!result} />
          <span className="text-slate-300">›</span>
          <StepBadge n={4} label="ייבוא ל-DB" active={!!result} done={!!result} />
        </div>
      </Card>

      {process.env.NODE_ENV === "development" && (
        <Card className="p-2 mb-3 text-[10px] font-mono text-slate-600 bg-slate-50 border-slate-200">
          urlProjectId: {urlProjectId ?? "—"} · selectedProjectId: {selectedProjectId || "—"} ·
          selectedProject: {selectedProject?.name ?? "—"} · canUpload: {String(canUpload)}
        </Card>
      )}

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
          {error}
        </div>
      )}

      {result ? (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="h-7 w-7 text-risk-low" />
            <div>
              <div className="text-[15px] font-semibold text-slate-800">הייבוא הושלם בהצלחה</div>
              <div className="text-[12.5px] text-slate-500">
                נוצרה גרסת BOM ‏«{result.version_name}» (#{result.bom_version_id}) עם{" "}
                <span className="font-semibold">{result.rows_imported}</span> שורות.
              </div>
            </div>
          </div>
          {result.rows_imported === 0 && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
              לא יובאו שורות BOM. נסרקו {result.total_rows_scanned} שורות. ודא מיפוי עמודות ושורת כותרות נכונה.
            </div>
          )}
          <div className="mb-3 text-[11.5px] text-slate-500">
            סך נסרקו {result.total_rows_scanned} · יובאו {result.rows_imported} · שורות ריקות שדולגו {result.empty_rows_skipped} · שורות לא תקינות שדולגו {result.invalid_rows_skipped} · נדרשות בדיקה {result.rows_needing_review}
          </div>
          {result.skipped_rows_sample && result.skipped_rows_sample.length > 0 && (
            <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2.5">
              <div className="text-[11px] text-slate-500 mb-1">דוגמאות לשורות שדולגו:</div>
              {result.skipped_rows_sample.map((s, i) => (
                <div key={i} className="text-[11px] text-slate-600 font-mono truncate">{s}</div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="rounded-md border border-slate-200 p-2.5">
              <div className="text-[10.5px] text-slate-500">Rows Imported</div>
              <div className="text-[18px] font-bold tabular-nums">{result.rows_imported}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-2.5">
              <div className="text-[10.5px] text-slate-500">Needs Review</div>
              <div className="text-[18px] font-bold tabular-nums text-amber-700">
                {result.needs_review_count}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-2.5">
              <div className="text-[10.5px] text-slate-500">Missing MPN</div>
              <div className="text-[18px] font-bold tabular-nums">{result.missing_mpn_count}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-2.5">
              <div className="text-[10.5px] text-slate-500">DNP</div>
              <div className="text-[18px] font-bold tabular-nums">{result.dnp_count}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/bom?version_id=${result.bom_version_id}`}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90"
            >
              <Table2 className="h-4 w-4" /> פתח טבלת BOM
            </Link>
            <Link
              href="/activity"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] hover:bg-slate-50"
            >
              צפה ביומן פעולות
            </Link>
            <button
              onClick={() => {
                setPreview(null);
                setResult(null);
              }}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] hover:bg-slate-50"
            >
              ייבוא נוסף
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="p-4 lg:col-span-1 space-y-3 h-fit">
            <div>
              <label className="block text-[12px] text-slate-600 mb-1">פרויקט</label>
              <select
                value={selectedProjectId || ""}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  if (e.target.value) setError(null);
                }}
                className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
              >
                <option value="">בחר פרויקט</option>
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
            {canUpload && selectedProject && (
              <div className="rounded-md border border-brand/20 bg-brand-soft/40 p-3 text-[12px]">
                <div className="font-semibold text-navy mb-2">טעינת ה-BOM תתבצע לפרויקט:</div>
                <div className="space-y-1 text-[11.5px]">
                  <div>
                    <span className="text-slate-500">לקוח: </span>
                    <span className="font-medium">{selectedCustomerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">שם פרויקט: </span>
                    <span className="font-medium">{selectedProject.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">קוד פרויקט: </span>
                    <span className="font-medium">{selectedProject.code}</span>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-[12px] text-slate-600 mb-1">שם גרסת BOM</label>
              <input
                value={versionLabel}
                onChange={(e) => {
                  setVersionLabel(e.target.value);
                  setVersionEdited(true);
                }}
                placeholder="R09 / v1"
                className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
              />
              {preview && (
                <p className="mt-1 text-[10.5px] text-slate-400 leading-snug">
                  המערכת זיהתה גרסה מתוך הקובץ. ניתן לעדכן ידנית לפני הייבוא.
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
              <input type="checkbox" checked={setActive} onChange={(e) => setSetActive(e.target.checked)} />
              קבע כגרסה פעילה
            </label>

            <label
              className={
                "flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-8 transition-colors " +
                (canUpload
                  ? "cursor-pointer hover:border-brand/50 hover:bg-brand-soft/40"
                  : "cursor-not-allowed opacity-60")
              }
            >
              {busy && !preview ? (
                <Loader2 className="h-8 w-8 text-brand animate-spin" />
              ) : (
                <UploadCloud className="h-8 w-8 text-brand" />
              )}
              <div className="text-[12.5px] font-medium text-slate-700">
                {preview ? "החלף קובץ" : "בחר קובץ BOM"}
              </div>
              <div className="text-[10.5px] text-slate-400">.xlsx, .xls, .csv</div>
              {!canUpload && (
                <div className="text-[10.5px] text-slate-500 text-center px-2">
                  יש לבחור פרויקט לפני העלאת קובץ BOM
                </div>
              )}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={!canUpload}
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>

            {preview && (
              <>
                <div className="flex items-center gap-2 text-[12px] text-slate-600">
                  <FileSpreadsheet className="h-4 w-4 text-risk-low" />
                  <span className="font-medium truncate">{preview.file_name}</span>
                  <Badge className="bg-brand-soft text-brand border-brand/30">
                    {preview.total_rows} שורות
                  </Badge>
                </div>

                {preview.sheet_names.length > 1 && (
                  <div>
                    <label className="block text-[12px] text-slate-600 mb-1">גליון (Sheet)</label>
                    <select
                      value={preview.sheet_name}
                      onChange={(e) => rePreview({ sheetName: e.target.value })}
                      className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
                    >
                      {preview.sheet_names.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Header row selector */}
                <div className="rounded-md border border-slate-200 p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700">
                    <Rows3 className="h-3.5 w-3.5 text-brand" /> שורת כותרות בטבלה (Header Row)
                  </div>
                  <div className="text-[10.5px] text-slate-500">
                    {detectedHuman != null
                      ? `זוהתה אוטומטית: שורה ${detectedHuman}`
                      : "לא זוהתה שורת כותרות — יש לבחור ידנית"}
                  </div>
                  <select
                    value={preview.header_row_index ?? ""}
                    onChange={(e) => rePreview({ headerRowIndex: Number(e.target.value) })}
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] text-slate-500">בחירה ידנית (מס׳ שורה):</span>
                    <input
                      type="number"
                      min={1}
                      value={headerHuman ?? ""}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 1) rePreview({ headerRowIndex: v - 1 });
                      }}
                      className="w-20 h-8 rounded-md border border-slate-200 px-2 text-[12px]"
                    />
                  </div>
                </div>

                {/* Metadata above header */}
                {preview.metadata_rows.length > 0 && (
                  <div className="rounded-md border border-slate-200">
                    <button
                      onClick={() => setShowMeta((s) => !s)}
                      className="w-full flex items-center gap-1.5 px-2.5 py-2 text-[12px] text-slate-700 hover:bg-slate-50"
                    >
                      {showMeta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      מידע שנמצא מעל טבלת ה-BOM ({preview.metadata_rows.length})
                    </button>
                    {showMeta && (
                      <div className="px-3 pb-2 space-y-1">
                        {preview.metadata_rows.map((r, i) => (
                          <div key={i} className="text-[11px] text-slate-500">
                            {r.filter(Boolean).join(" · ")}
                          </div>
                        ))}
                        <div className="text-[10px] text-slate-400 pt-1">
                          שורות אלו לא ישמשו למיפוי עמודות ולא ייובאו.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>

          <Card className="p-4 lg:col-span-2">
            {!preview ? (
              <div className="text-[12.5px] text-slate-400 py-10 text-center">
                העלה קובץ כדי לראות תצוגה מקדימה ולמפות עמודות.
              </div>
            ) : (
              <>
                {preview.warning && (
                  <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-[12px] px-3 py-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{preview.warning}</span>
                  </div>
                )}

                {/* Detected file metadata */}
                <div className="mb-4 rounded-md border border-brand/20 bg-brand-soft/40 p-3">
                  <div className="text-[12.5px] font-semibold text-navy mb-2">
                    נתונים שזוהו מהקובץ
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[11.5px]">
                    <div>
                      <span className="text-slate-500">Board Name: </span>
                      <span className="font-medium">{preview.extracted_metadata.board_name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Doc Number: </span>
                      <span className="font-medium">{preview.extracted_metadata.doc_number || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Revision: </span>
                      <span className="font-medium">
                        {preview.extracted_metadata.revision_code ||
                          preview.extracted_metadata.revision ||
                          "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Revised Date: </span>
                      <span className="font-medium">{preview.extracted_metadata.revised_date || "—"}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500">Suggested BOM Version: </span>
                      <span className="font-semibold text-brand">{preview.suggested_version_name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <Table2 className="h-4 w-4 text-brand" />
                  <h2 className="text-[13.5px] font-semibold">תצוגה מקדימה</h2>
                  {headerHuman != null && (
                    <span className="text-[11px] text-slate-400">
                      (שורת כותרות: שורה {headerHuman} · {preview.rows.length} מתוך {preview.total_rows})
                    </span>
                  )}
                </div>

                {preview.columns.length > 0 ? (
                  <div className="overflow-auto border border-slate-200 rounded-md mb-4 max-h-56">
                    <table className="w-full text-[11.5px]">
                      <thead className="bg-brand-soft sticky top-0">
                        <tr className="text-right text-brand">
                          {preview.columns.map((c, i) => (
                            <th key={i} className="px-2 py-1.5 font-semibold whitespace-nowrap border-b border-brand/20">
                              {c || <span className="text-slate-300">—</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            {preview.columns.map((_, j) => (
                              <td key={j} className="px-2 py-1 whitespace-nowrap text-slate-700">
                                {r[j] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-[12px] text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-md mb-4">
                    בחר שורת כותרות כדי להציג עמודות ושורות.
                  </div>
                )}

                {preview.columns.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-4 w-4 text-brand" />
                      <h2 className="text-[13.5px] font-semibold">מיפוי עמודות</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                      {FIELDS.map((f) => (
                        <div key={f.key}>
                          <label className="block text-[11px] text-slate-600 mb-1">
                            {f.label}
                            {f.required && <span className="text-red-500"> *</span>}
                          </label>
                          <select
                            value={mapping[f.key] ?? NONE}
                            onChange={(e) =>
                              setMapping((m) => ({
                                ...m,
                                [f.key]: e.target.value === NONE ? null : e.target.value,
                              }))
                            }
                            className="w-full h-8 rounded-md border border-slate-200 px-2 text-[12px] bg-white"
                          >
                            <option value={NONE}>— ללא —</option>
                            {preview.columns.filter(Boolean).map((c, i) => (
                              <option key={i} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={doImport}
                      disabled={busy || !canUpload}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                      ייבוא ל-DB
                    </button>
                  </>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

export default function UploadBomPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <UploadBomInner />
    </Suspense>
  );
}
