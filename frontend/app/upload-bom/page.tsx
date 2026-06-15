"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  Table2,
  Database,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, PageHeader, Badge } from "@/components/ui";
import { apiGet, apiUpload, apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = { id: number; name: string; code: string };

type Preview = {
  file_path: string;
  file_name: string;
  columns: string[];
  rows: string[][];
  total_rows: number;
  suggested_mapping: Record<string, string | null>;
};

type ImportResult = {
  bom_version_id: number;
  line_count: number;
  project_id: number;
  version_label: string;
};

const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "mpn", label: "MPN", required: true },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "description", label: "תיאור" },
  { key: "quantity", label: "Qty" },
  { key: "reference_designators", label: "Ref Designators" },
  { key: "unit", label: "Unit" },
  { key: "customer_price", label: "Customer Price" },
  { key: "internal_cost", label: "Internal Cost" },
  { key: "is_critical", label: "Critical" },
];

const NONE = "__none__";

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={
          "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold " +
          (done
            ? "bg-risk-low text-white"
            : active
              ? "bg-brand text-white"
              : "bg-slate-200 text-slate-500")
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

export default function UploadBomPage() {
  const { user } = useCurrentUser();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [setActive, setSetActive] = useState(true);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects")
      .then((p) => {
        setProjects(p);
        if (p.length) setProjectId(p[0].id);
      })
      .catch(() => setError("לא ניתן לטעון פרויקטים — ודא שה-API פעיל."));
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const pv = await apiUpload<Preview>("/api/bom-import/preview", file, user.id);
      setPreview(pv);
      setMapping(pv.suggested_mapping);
      if (!versionLabel) setVersionLabel(`v${new Date().toISOString().slice(0, 10)}`);
    } catch (e) {
      setError(String(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!preview || !projectId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<ImportResult>(
        "/api/bom-import/commit",
        {
          project_id: projectId,
          version_label: versionLabel || "v-import",
          status: "In Review",
          source: "excel-import",
          file_path: preview.file_path,
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

  return (
    <>
      <PageHeader
        title="טעינת BOM"
        subtitle="העלאת קובץ Excel/CSV, מיפוי עמודות וייבוא לבסיס הנתונים"
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
              <div className="text-[15px] font-semibold text-slate-800">
                הייבוא הושלם בהצלחה
              </div>
              <div className="text-[12.5px] text-slate-500">
                נוצרה גרסת BOM ‏«{result.version_label}» עם{" "}
                <span className="font-semibold">{result.line_count}</span> שורות.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/bom"
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
                value={projectId ?? ""}
                onChange={(e) => setProjectId(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-slate-600 mb-1">תווית גרסה</label>
              <input
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="v3.1"
                className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
              />
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
              <input
                type="checkbox"
                checked={setActive}
                onChange={(e) => setSetActive(e.target.checked)}
              />
              קבע כגרסה פעילה
            </label>

            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-8 cursor-pointer hover:border-brand/50 hover:bg-brand-soft/40 transition-colors">
              {busy && !preview ? (
                <Loader2 className="h-8 w-8 text-brand animate-spin" />
              ) : (
                <UploadCloud className="h-8 w-8 text-brand" />
              )}
              <div className="text-[12.5px] font-medium text-slate-700">
                {preview ? "החלף קובץ" : "בחר קובץ BOM"}
              </div>
              <div className="text-[10.5px] text-slate-400">.xlsx, .xls, .csv</div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>

            {preview && (
              <div className="flex items-center gap-2 text-[12px] text-slate-600">
                <FileSpreadsheet className="h-4 w-4 text-risk-low" />
                <span className="font-medium truncate">{preview.file_name}</span>
                <Badge className="bg-brand-soft text-brand border-brand/30">
                  {preview.total_rows} שורות
                </Badge>
              </div>
            )}
          </Card>

          <Card className="p-4 lg:col-span-2">
            {!preview ? (
              <div className="text-[12.5px] text-slate-400 py-10 text-center">
                העלה קובץ כדי לראות תצוגה מקדימה ולמפות עמודות.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Table2 className="h-4 w-4 text-brand" />
                  <h2 className="text-[13.5px] font-semibold">תצוגה מקדימה</h2>
                  <span className="text-[11px] text-slate-400">
                    ({preview.rows.length} מתוך {preview.total_rows})
                  </span>
                </div>
                <div className="overflow-auto border border-slate-200 rounded-md mb-4 max-h-56">
                  <table className="w-full text-[11.5px]">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-right text-slate-500">
                        {preview.columns.map((c) => (
                          <th key={c} className="px-2 py-1.5 font-medium whitespace-nowrap">
                            {c}
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
                        {preview.columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <button
                  onClick={doImport}
                  disabled={busy || !projectId}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  ייבוא ל-DB
                </button>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
