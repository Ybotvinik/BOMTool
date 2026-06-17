"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { apiGet, apiPatch } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type Customer = { id: number; name: string };
type BomVersion = {
  id: number;
  version_label: string;
  version_name: string | null;
  is_active: boolean;
};

export type ProjectParamsForm = {
  name: string;
  customer_id: number | "";
  build_quantity: string;
  status: string;
  description: string;
  board_name: string;
  source_doc_number: string;
  revision_code: string;
  active_version_id: number | "";
  version_notes: string;
};

export function EditProjectParamsModal({
  projectId,
  initial,
  versionId,
  onClose,
  onSaved,
}: {
  projectId: number;
  initial: ProjectParamsForm;
  versionId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useCurrentUser();
  const [form, setForm] = useState(initial);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [versions, setVersions] = useState<BomVersion[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<Customer[]>("/api/customers"),
      apiGet<BomVersion[]>(`/api/bom-versions?project_id=${projectId}`),
    ]).then(([cs, vs]) => {
      setCustomers(cs);
      setVersions(vs);
    });
  }, [projectId]);

  async function save() {
    const bq = Number(form.build_quantity);
    if (!form.name.trim()) {
      setErr("שם פרויקט נדרש");
      return;
    }
    if (!Number.isFinite(bq) || bq <= 0) {
      setErr("כמות להרכבה חייבת להיות מספר חיובי");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiPatch(
        `/api/projects/${projectId}`,
        {
          name: form.name.trim(),
          customer_id: form.customer_id === "" ? undefined : form.customer_id,
          build_quantity: bq,
          status: form.status,
          description: form.description.trim() || null,
          active_version_id:
            form.active_version_id === "" ? null : form.active_version_id,
        },
        user.id,
      );
      if (versionId != null) {
        const targetVid =
          form.active_version_id === "" ? versionId : Number(form.active_version_id);
        await apiPatch(
          `/api/bom-versions/${targetVid}`,
          {
            board_name: form.board_name.trim() || null,
            source_doc_number: form.source_doc_number.trim() || null,
            revision_code: form.revision_code.trim() || null,
            build_quantity: bq,
            notes: form.version_notes.trim() || null,
          },
          user.id,
        );
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(String(e).replace(/^Error:\s*/, ""));
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
          <h2 className="text-[15px] font-bold text-navy">עריכת פרמטרים</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            כמות להרכבה משמשת כמכפיל לחישוב Required Qty — לא משנה את Qty המקורי של
            כל שורת BOM
          </p>
        </div>
        <div className="p-4 space-y-3 overflow-auto flex-1">
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
              {err}
            </div>
          )}
          <Field label="שם פרויקט">
            <input
              className={inp}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="לקוח">
            <select
              className={inp}
              value={form.customer_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  customer_id: e.target.value ? Number(e.target.value) : "",
                }))
              }
            >
              <option value="">בחר לקוח</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="כמות להרכבה / Build Quantity">
              <input
                type="number"
                min={1}
                className={inp}
                value={form.build_quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, build_quantity: e.target.value }))
                }
              />
            </Field>
            <Field label="סטטוס פרויקט">
              <select
                className={inp}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {["Active", "In Review", "Quoting", "Archived"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="גרסת BOM פעילה">
            <select
              className={inp}
              value={form.active_version_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  active_version_id: e.target.value ? Number(e.target.value) : "",
                }))
              }
            >
              <option value="">לא נבחרה</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_name ?? v.version_label}
                  {v.is_active ? " ★" : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-medium text-slate-600 mb-2">פרמטרי BOM פעיל</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Board Name">
                <input
                  className={inp}
                  value={form.board_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, board_name: e.target.value }))
                  }
                />
              </Field>
              <Field label="Doc Number">
                <input
                  className={inp}
                  value={form.source_doc_number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, source_doc_number: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Revision">
              <input
                className={inp}
                value={form.revision_code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, revision_code: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="הערות פרויקט">
            <textarea
              className={clsx(inp, "h-16 py-1.5")}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </Field>
          {versionId != null && (
            <Field label="הערות גרסת BOM">
              <textarea
                className={clsx(inp, "h-16 py-1.5")}
                value={form.version_notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, version_notes: e.target.value }))
                }
              />
            </Field>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium disabled:opacity-60"
          >
            {busy ? "שומר…" : "שמירה"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-9 px-4 rounded-md border border-slate-200 text-[12.5px]"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
