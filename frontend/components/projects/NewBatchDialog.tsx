"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileSpreadsheet, Loader2, PackagePlus } from "lucide-react";
import { apiPost } from "@/lib/api";
import { projectOverviewHref } from "@/lib/project-overview";
import { useCurrentUser } from "@/lib/current-user";

export type NewBatchDialogTarget = {
  cardId: number;
  cardName: string;
  projectId: number;
  projectName: string;
  buildQuantityDefault: number;
  batches: {
    batch_id: number;
    batch_label: string;
    is_active_batch: boolean;
    bom_items_count: number;
  }[];
};

type SourceMode = "copy" | "file" | "empty";

type Props = {
  target: NewBatchDialogTarget;
  onClose: () => void;
  onCreated: () => void;
};

export function NewBatchDialog({ target, onClose, onCreated }: Props) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [batchLabel, setBatchLabel] = useState("");
  const [buildQty, setBuildQty] = useState(target.buildQuantityDefault);
  const [sourceMode, setSourceMode] = useState<SourceMode>(
    target.batches.length ? "copy" : "file",
  );
  const [copyFromId, setCopyFromId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultSourceBatchId = useMemo(() => {
    if (!target.batches.length) return null;
    const active = target.batches.find((b) => b.is_active_batch);
    return active?.batch_id ?? target.batches[target.batches.length - 1].batch_id;
  }, [target.batches]);

  useEffect(() => {
    setBuildQty(target.buildQuantityDefault);
    setSourceMode(target.batches.length ? "copy" : "file");
    setCopyFromId(defaultSourceBatchId ?? "");
    setBatchLabel("");
    setError(null);
  }, [target, defaultSourceBatchId]);

  async function submit() {
    if (!Number.isFinite(buildQty) || buildQty <= 0) {
      setError("כמות להרכבה חייבת להיות מספר חיובי");
      return;
    }
    if (sourceMode === "copy" && !copyFromId) {
      setError("בחר מנה להעתקה");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        batch_label: batchLabel.trim() || undefined,
        build_quantity: buildQty,
        set_active: true,
      };
      if (sourceMode === "copy") {
        body.copy_from_version_id = Number(copyFromId);
      }

      const created = await apiPost<{ id: number }>(
        `/api/project-cards/${target.cardId}/batches`,
        body,
        user.id,
      );

      onCreated();
      onClose();

      if (sourceMode === "file") {
        const qs = new URLSearchParams({
          project_id: String(target.projectId),
          card_id: String(target.cardId),
          version_id: String(created.id),
        });
        router.push(`/upload-bom?${qs.toString()}`);
        return;
      }

      router.push(
        projectOverviewHref(target.projectId, target.cardId, created.id),
      );
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  const inp =
    "w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div dir="rtl" className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <PackagePlus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-navy">מנה חדשה</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {target.projectName} · כרטיס {target.cardName}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-auto flex-1">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                שם מנה (אופציונלי)
              </label>
              <input
                className={inp}
                value={batchLabel}
                onChange={(e) => setBatchLabel(e.target.value)}
                placeholder={`מנה ${target.batches.length + 1}`}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                כמות להרכבה *
              </label>
              <input
                type="number"
                min={1}
                className={inp}
                value={buildQty}
                onChange={(e) => setBuildQty(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-slate-700 mb-2">מקור ה-BOM</p>
            <div className="space-y-2">
              {target.batches.length > 0 && (
                <SourceOption
                  selected={sourceMode === "copy"}
                  onSelect={() => setSourceMode("copy")}
                  icon={<Copy className="h-4 w-4" />}
                  title="המשך מהמנה הנוכחית"
                  description="העתקת שורות BOM ממנה קיימת — אותה רשימת רכיבים, כמות הרכבה חדשה"
                >
                  <select
                    className={inp + " mt-2"}
                    value={copyFromId}
                    onChange={(e) =>
                      setCopyFromId(e.target.value ? Number(e.target.value) : "")
                    }
                    disabled={sourceMode !== "copy"}
                  >
                    {target.batches.map((b) => (
                      <option key={b.batch_id} value={b.batch_id}>
                        {b.batch_label}
                        {b.is_active_batch ? " (פעיל)" : ""}
                        {b.bom_items_count ? ` · ${b.bom_items_count} פריטים` : ""}
                      </option>
                    ))}
                  </select>
                </SourceOption>
              )}

              <SourceOption
                selected={sourceMode === "file"}
                onSelect={() => setSourceMode("file")}
                icon={<FileSpreadsheet className="h-4 w-4" />}
                title="קובץ BOM חדש"
                description="יצירת המנה ומעבר להעלאת Excel/CSV — רשימת רכיבים מעודכנת"
              />

              <SourceOption
                selected={sourceMode === "empty"}
                onSelect={() => setSourceMode("empty")}
                icon={<PackagePlus className="h-4 w-4" />}
                title="מנה ריקה"
                description="יצירת מנה ללא שורות — ניתן לטעון BOM או לערוך מאוחר יותר"
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-semibold hover:bg-brand/90 disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {sourceMode === "file" ? "צור מנה והעלה קובץ" : "צור מנה"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] hover:bg-slate-50"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceOption({
  selected,
  onSelect,
  icon,
  title,
  description,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "w-full text-right rounded-lg border p-3 transition-colors " +
        (selected
          ? "border-brand bg-brand/5 ring-1 ring-brand/20"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80")
      }
    >
      <div className="flex items-start gap-2">
        <span
          className={
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md " +
            (selected ? "bg-brand/15 text-brand" : "bg-slate-100 text-slate-500")
          }
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-slate-800">{title}</div>
          <div className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">{description}</div>
          {selected ? children : null}
        </div>
      </div>
    </button>
  );
}
