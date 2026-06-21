"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  FolderOpen,
  GitBranch,
  Layers,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  Search,
  Upload,
  Trash2,
} from "lucide-react";
import { Badge, Card, Kpi, StatusBadge } from "@/components/ui";
import {
  NewBatchDialog,
  type NewBatchDialogTarget,
} from "@/components/projects/NewBatchDialog";
import {
  DeleteBatchDialog,
  type DeleteBatchDialogTarget,
} from "@/components/projects/DeleteBatchDialog";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { projectOverviewHref } from "@/lib/project-overview";
import { useCurrentUser } from "@/lib/current-user";

const PROJECT_STATUS_OPTIONS = ["NEW", "ACTIVE", "DONE"] as const;
const CARD_STATUS_OPTIONS = ["NEW", "ACTIVE", "DONE"] as const;
const NEW_CUSTOMER = "new";

const PROJECT_STATUS_LABELS: Record<string, string> = {
  NEW: "חדש — פתיחה והגדרות",
  ACTIVE: "פעיל — עבודה שוטפת",
  DONE: "הסתיים",
};

type ApiProject = {
  id: number;
  customer_id: number;
  name: string;
  code: string;
  status: string;
  description: string | null;
  drive_folder_url: string | null;
  active_version_id: number | null;
  updated_at: string;
};

type ApiProjectCard = {
  id: number;
  project_id: number;
  name: string;
  code: string | null;
  board_name: string | null;
  status: string;
  build_quantity: number;
  notes: string | null;
};

type ApiCustomer = { id: number; name: string; code: string | null };

type WorkspaceBatch = {
  batch_id: number;
  batch_label: string;
  card_id: number;
  card_name: string;
  card_board_name: string | null;
  project_id: number;
  project_name: string;
  project_code: string;
  project_status: string;
  batch_status: string;
  drive_folder_url: string | null;
  customer_id: number;
  customer_name: string;
  bom_version_label: string | null;
  bom_version_name: string | null;
  is_active_batch: boolean;
  bom_items_count: number;
  opened_at: string | null;
  closed_at: string | null;
  updated_at: string | null;
  updated_by_user_id: number | null;
  updated_by_name: string | null;
};

type WorkspaceTreeCard = {
  id: number;
  name: string;
  code: string | null;
  board_name: string | null;
  status: string;
  build_quantity: number;
  batches: WorkspaceBatch[];
};

type WorkspaceTreeProject = {
  id: number;
  name: string;
  code: string;
  status: string;
  drive_folder_url: string | null;
  cards: WorkspaceTreeCard[];
};

type WorkspaceTreeCustomer = {
  id: number;
  name: string;
  code: string | null;
  projects: WorkspaceTreeProject[];
};

type WorkspaceSummary = {
  customer_count: number;
  project_count: number;
  card_count: number;
  batch_count: number;
  active_projects: number;
  in_review_projects: number;
  needs_review_total: number;
};

type WorkspaceResponse = {
  summary: WorkspaceSummary;
  customers: WorkspaceTreeCustomer[];
  batches: WorkspaceBatch[];
};

type ProjectViewFilter = "all" | "active" | "closed";

const PROJECT_VIEW_FILTERS: { id: ProjectViewFilter; label: string }[] = [
  { id: "all", label: "כולם" },
  { id: "active", label: "פעילים" },
  { id: "closed", label: "סגורים" },
];

function normalizeProjectStatus(status: string): string {
  const raw = status.trim();
  if (raw === "NEW" || raw === "ACTIVE" || raw === "DONE") return raw;
  const lower = raw.toLowerCase();
  if (lower === "active" || lower === "in review" || lower === "quoting") return "ACTIVE";
  if (lower === "archived") return "DONE";
  return "NEW";
}

function projectMatchesViewFilter(status: string, filter: ProjectViewFilter): boolean {
  const normalized = normalizeProjectStatus(status);
  if (filter === "all") return true;
  if (filter === "active") return normalized === "NEW" || normalized === "ACTIVE";
  return normalized === "DONE";
}

function filterWorkspaceTree(
  workspace: WorkspaceResponse,
  filter: ProjectViewFilter,
): WorkspaceResponse {
  if (filter === "all") return workspace;

  const customers = workspace.customers
    .map((customer) => ({
      ...customer,
      projects: customer.projects.filter((p) => projectMatchesViewFilter(p.status, filter)),
    }))
    .filter((customer) => customer.projects.length > 0);

  const visibleProjectIds = new Set(
    customers.flatMap((c) => c.projects.map((p) => p.id)),
  );

  return {
    ...workspace,
    customers,
    batches: workspace.batches.filter((b) => visibleProjectIds.has(b.project_id)),
  };
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = v.slice(0, 10);
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}

function bomHref(projectId: number, batchId: number) {
  return `/bom?project_id=${projectId}&version_id=${batchId}`;
}

function openDrive(url: string | null | undefined) {
  const trimmed = (url || "").trim();
  if (!trimmed) {
    alert("לא הוגדר קישור לספריית Drive לפרויקט זה. ניתן להוסיף בעריכת הפרויקט.");
    return;
  }
  window.open(trimmed, "_blank", "noopener,noreferrer");
}

type Props = {
  live: boolean;
  onReload: () => void;
};

export function ProjectsWorkspace({ live, onReload }: Props) {
  const { user } = useCurrentUser();
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<ProjectViewFilter>("active");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [editRow, setEditRow] = useState<ApiProject | null>(null);
  const [fCustomer, setFCustomer] = useState("");
  const [fNewName, setFNewName] = useState("");
  const [fNewCode, setFNewCode] = useState("");
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fStatus, setFStatus] = useState("NEW");
  const [fDesc, setFDesc] = useState("");
  const [fDriveUrl, setFDriveUrl] = useState("");
  const [editCard, setEditCard] = useState<ApiProjectCard | null>(null);
  const [fCardName, setFCardName] = useState("");
  const [fCardBoard, setFCardBoard] = useState("");
  const [fCardQty, setFCardQty] = useState(1);
  const [fCardStatus, setFCardStatus] = useState("NEW");
  const [fCardNotes, setFCardNotes] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newBatchTarget, setNewBatchTarget] = useState<NewBatchDialogTarget | null>(null);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<DeleteBatchDialogTarget | null>(null);
  const [deleteBatchError, setDeleteBatchError] = useState<string | null>(null);
  const [deleteBatchBusy, setDeleteBatchBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadWorkspace = useCallback(async () => {
    if (!live) return;
    setLoading(true);
    try {
      const qs = debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : "";
      const [ws, cs] = await Promise.all([
        apiGet<WorkspaceResponse>(`/api/projects/workspace${qs}`),
        apiGet<ApiCustomer[]>("/api/customers"),
      ]);
      setWorkspace(ws);
      setCustomers(cs);
      setExpanded((prev) => {
        if (Object.keys(prev).length) return prev;
        const next: Record<string, boolean> = {};
        for (const c of ws.customers) {
          next[`customer-${c.id}`] = true;
          for (const p of c.projects) {
            next[`project-${p.id}`] = true;
            for (const card of p.cards) {
              next[`card-${card.id}`] = true;
            }
          }
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [live, debouncedSearch]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const summary = workspace?.summary;

  const filterCounts = useMemo(() => {
    if (!workspace) return { all: 0, active: 0, closed: 0 };
    let all = 0;
    let active = 0;
    let closed = 0;
    for (const customer of workspace.customers) {
      for (const project of customer.projects) {
        all += 1;
        const status = normalizeProjectStatus(project.status);
        if (status === "DONE") closed += 1;
        else active += 1;
      }
    }
    return { all, active, closed };
  }, [workspace]);

  const displayWorkspace = useMemo(
    () => (workspace ? filterWorkspaceTree(workspace, projectFilter) : null),
    [workspace, projectFilter],
  );

  const flatBatchCount = useMemo(
    () => displayWorkspace?.batches.length ?? 0,
    [displayWorkspace?.batches.length],
  );

  const visibleProjectCount = useMemo(() => {
    if (!displayWorkspace) return 0;
    return displayWorkspace.customers.reduce((n, c) => n + c.projects.length, 0);
  }, [displayWorkspace]);

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  async function openEditProject(projectId: number) {
    const p = await apiGet<ApiProject>(`/api/projects/${projectId}`);
    setActionError(null);
    setEditRow(p);
    setFCustomer(String(p.customer_id));
    setFNewName("");
    setFNewCode("");
    setFName(p.name);
    setFCode(p.code);
    setFStatus(p.status);
    setFDesc(p.description ?? "");
    setFDriveUrl(p.drive_folder_url ?? "");
  }

  async function openEditCard(cardId: number) {
    const card = await apiGet<ApiProjectCard>(`/api/project-cards/${cardId}`);
    setActionError(null);
    setEditCard(card);
    setFCardName(card.name);
    setFCardBoard(card.board_name ?? "");
    setFCardQty(card.build_quantity);
    setFCardStatus(card.status);
    setFCardNotes(card.notes ?? "");
  }

  async function saveEditCard() {
    if (!editCard) return;
    if (!fCardName.trim()) return setActionError("שם כרטיס נדרש");
    if (!Number.isFinite(fCardQty) || fCardQty <= 0)
      return setActionError("כמות להרכבה חייבת להיות מספר חיובי");

    setActionBusy(true);
    setActionError(null);
    try {
      await apiPatch(
        `/api/project-cards/${editCard.id}`,
        {
          name: fCardName.trim(),
          board_name: fCardBoard.trim() || null,
          build_quantity: fCardQty,
          status: fCardStatus,
          notes: fCardNotes.trim() || null,
        },
        user.id,
      );
      setEditCard(null);
      await loadWorkspace();
      onReload();
    } catch (e) {
      setActionError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setActionBusy(false);
    }
  }

  async function saveEdit() {
    if (!editRow) return;
    if (!fName.trim()) return setActionError("שם פרויקט נדרש");
    if (!fCode.trim()) return setActionError("קוד פרויקט נדרש");
    if (fCustomer === NEW_CUSTOMER && !fNewName.trim())
      return setActionError("שם לקוח חדש נדרש");

    setActionBusy(true);
    setActionError(null);
    try {
      const body: Record<string, unknown> = {
        name: fName,
        code: fCode,
        status: fStatus,
        description: fDesc || null,
        drive_folder_url: fDriveUrl.trim() || null,
      };
      if (fCustomer === NEW_CUSTOMER) {
        body.new_customer = { name: fNewName, code: fNewCode || null };
      } else {
        body.customer_id = Number(fCustomer);
      }
      await apiPatch(`/api/projects/${editRow.id}`, body, user.id);
      setEditRow(null);
      await loadWorkspace();
      onReload();
    } catch (e) {
      setActionError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setActionBusy(false);
    }
  }

  async function addCard(projectId: number, projectName: string) {
    const name = window.prompt("שם הכרטיס:", projectName);
    if (!name?.trim()) return;
    setBusyKey(`card-${projectId}`);
    try {
      await apiPost(`/api/projects/${projectId}/cards`, { name: name.trim() }, user.id);
      await loadWorkspace();
    } catch (e) {
      alert(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusyKey(null);
    }
  }

  function openDeleteBatchDialog(batch: WorkspaceBatch) {
    setDeleteBatchError(null);
    setDeleteBatchTarget({
      batchId: batch.batch_id,
      batchLabel: batch.batch_label,
      cardName: batch.card_name,
      projectName: batch.project_name,
      bomItemsCount: batch.bom_items_count,
      isActiveBatch: batch.is_active_batch,
    });
  }

  async function confirmDeleteBatch() {
    if (!deleteBatchTarget) return;
    setDeleteBatchBusy(true);
    setDeleteBatchError(null);
    try {
      await apiDelete(`/api/bom-versions/${deleteBatchTarget.batchId}`, user.id);
      const label = deleteBatchTarget.batchLabel;
      setDeleteBatchTarget(null);
      setNotice(`המנה «${label}» נמחקה בהצלחה`);
      await loadWorkspace();
      onReload();
    } catch (e) {
      setDeleteBatchError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setDeleteBatchBusy(false);
    }
  }

  function openNewBatchDialog(card: WorkspaceTreeCard, project: WorkspaceTreeProject) {
    setNewBatchTarget({
      cardId: card.id,
      cardName: card.name,
      projectId: project.id,
      projectName: project.name,
      buildQuantityDefault: card.build_quantity,
      batches: card.batches.map((b) => ({
        batch_id: b.batch_id,
        batch_label: b.batch_label,
        is_active_batch: b.is_active_batch,
        bom_items_count: b.bom_items_count,
      })),
    });
  }

  if (!live) {
    return (
      <Card className="p-6 text-center text-slate-500 text-[13px]">
        מצב דמו — חבר את ה-API כדי לראות עץ לקוחות / פרויקטים / כרטיסים / מנות.
      </Card>
    );
  }

  return (
    <>
      {notice && (
        <div className="mb-3 rounded-md border border-green-200 bg-green-50 text-green-800 text-[12.5px] px-3 py-2">
          {notice}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 shrink-0">
          {PROJECT_VIEW_FILTERS.map((item) => {
            const selected = projectFilter === item.id;
            const count = filterCounts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setProjectFilter(item.id)}
                className={
                  "h-8 px-3 rounded text-[12px] font-medium transition-colors " +
                  (selected
                    ? "bg-brand text-brand-fg shadow-sm"
                    : "text-slate-600 hover:bg-slate-50")
                }
              >
                {item.label}
                <span
                  className={
                    "mr-1.5 tabular-nums text-[10px] " +
                    (selected ? "text-brand-fg/80" : "text-slate-400")
                  }
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי לקוח, פרויקט, כרטיס או מנה…"
            className="w-full h-9 rounded-md border border-slate-200 pr-8 pl-3 text-[12.5px] bg-white"
          />
        </div>
        {loading && (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> טוען…
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        <Kpi label="לקוחות" value={summary?.customer_count ?? "—"} />
        <Kpi
          label={projectFilter === "all" ? "פרויקטים" : "פרויקטים מוצגים"}
          value={projectFilter === "all" ? (summary?.project_count ?? "—") : visibleProjectCount}
        />
        <Kpi label="כרטיסים" value={summary?.card_count ?? "—"} />
        <Kpi label="מנות (שורות)" value={flatBatchCount} />
        <Kpi label="פרויקטים פעילים" value={summary?.active_projects ?? "—"} tone="good" />
        <Kpi label="פרויקטים חדשים" value={summary?.in_review_projects ?? "—"} />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-right border-b border-slate-200">
              <th className="px-3 py-2.5 font-bold w-[30%]">לקוח / פרויקט / כרטיס / מנה</th>
              <th className="px-3 py-2.5 font-bold text-center">BOM Items</th>
              <th className="px-3 py-2.5 font-bold">נפתח</th>
              <th className="px-3 py-2.5 font-bold">נסגר</th>
              <th className="px-3 py-2.5 font-bold">עודכן</th>
              <th className="px-3 py-2.5 font-bold">עודכן ע&quot;י</th>
              <th className="px-3 py-2.5 font-bold">סטטוס</th>
              <th className="px-3 py-2.5 font-bold text-center">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {!displayWorkspace?.customers.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                  {debouncedSearch
                    ? "לא נמצאו תוצאות לחיפוש"
                    : projectFilter === "closed"
                      ? "אין פרויקטים סגורים להצגה"
                      : projectFilter === "active"
                        ? "אין פרויקטים פעילים להצגה"
                        : "אין פרויקטים להצגה"}
                </td>
              </tr>
            ) : (
              displayWorkspace.customers.flatMap((customer) => {
                const cKey = `customer-${customer.id}`;
                const cOpen = expanded[cKey] !== false;
                const rows = [
                  <tr key={cKey} className="border-t border-blue-200 bg-blue-100/90">
                    <td colSpan={8} className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggle(cKey)}
                        className="inline-flex items-center gap-2 text-[16px] font-bold text-blue-900"
                      >
                        {cOpen ? (
                          <ChevronDown className="h-4 w-4 text-blue-700" />
                        ) : (
                          <ChevronLeft className="h-4 w-4 text-blue-700" />
                        )}
                        {customer.name}
                        {customer.code ? (
                          <span className="text-blue-700/80 font-semibold text-[14px]">({customer.code})</span>
                        ) : null}
                        <span className="text-[11px] font-semibold text-blue-700/70">
                          · {customer.projects.length} פרויקטים
                        </span>
                      </button>
                    </td>
                  </tr>,
                ];
                if (!cOpen) return rows;
                for (const project of customer.projects) {
                  const pKey = `project-${project.id}`;
                  const pOpen = expanded[pKey] !== false;
                  rows.push(
                    <tr key={pKey} className="border-t border-blue-100 bg-blue-50/95">
                      <td colSpan={5} className="px-3 py-2 pr-8">
                        <button
                          type="button"
                          onClick={() => toggle(pKey)}
                          className="inline-flex items-center gap-1.5 text-[14px] font-bold text-blue-700"
                        >
                          {pOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                          ) : (
                            <ChevronLeft className="h-3.5 w-3.5 text-blue-600" />
                          )}
                          <Link
                            href={projectOverviewHref(project.id)}
                            className="hover:underline text-blue-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {project.name}
                          </Link>
                          <span className="text-blue-600/80 font-semibold tabular-nums text-[13px]">
                            {project.code}
                          </span>
                          <span className="text-[11px] font-semibold text-blue-600/70">
                            · {project.cards.length} כרטיסים
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="פתיחת ספריית Drive"
                            onClick={() => openDrive(project.drive_folder_url)}
                            className="h-7 w-7 rounded-md hover:bg-white flex items-center justify-center text-slate-500 hover:text-brand border border-transparent hover:border-slate-200"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="כרטיס חדש"
                            disabled={busyKey === `card-${project.id}`}
                            onClick={() => addCard(project.id, project.name)}
                            className="h-7 w-7 rounded-md hover:bg-white flex items-center justify-center text-slate-500 hover:text-brand border border-transparent hover:border-slate-200 disabled:opacity-50"
                          >
                            <Layers className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="עריכת פרויקט"
                            onClick={() => openEditProject(project.id)}
                            className="h-7 w-7 rounded-md hover:bg-white flex items-center justify-center text-slate-500 hover:text-brand"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>,
                  );
                  if (!pOpen) continue;
                  for (const card of project.cards) {
                    const cardKey = `card-${card.id}`;
                    const cardOpen = expanded[cardKey] !== false;
                    rows.push(
                      <tr key={cardKey} className="border-t border-slate-100 bg-slate-50/40">
                        <td className="px-3 py-2 pr-14">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggle(cardKey)}
                              className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-slate-800"
                            >
                              {cardOpen ? (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                              ) : (
                                <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
                              )}
                              כרטיס: {card.name}
                              {card.board_name ? (
                                <span className="text-slate-600 font-semibold">· {card.board_name}</span>
                              ) : null}
                              <span className="text-[11px] font-medium text-slate-500">
                                ({card.batches.length} מנות)
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openNewBatchDialog(card, project)}
                              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-brand text-brand-fg text-[11px] font-semibold hover:bg-brand/90 shadow-sm"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              מנה חדשה
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums text-slate-600" title="כמות ברירת מחדל לכרטיס">
                          {card.build_quantity.toLocaleString()}
                        </td>
                        <td className="px-3 py-2" colSpan={4} />
                        <td className="px-3 py-2">
                          <StatusBadge status={card.status} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              title="עריכת כרטיס"
                              onClick={() => openEditCard(card.id)}
                              className="h-7 w-7 rounded-md hover:bg-white flex items-center justify-center text-slate-500 hover:text-brand"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>,
                    );
                    if (!cardOpen) continue;
                    for (const batch of card.batches) {
                      rows.push(
                        <tr key={`batch-${batch.batch_id}`} className="border-t border-slate-100 bg-white hover:bg-slate-50/60">
                          <td className="px-3 py-2 pr-20 text-[12px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-slate-800 truncate">{batch.batch_label}</span>
                              {batch.is_active_batch && (
                                <Badge className="bg-green-50 text-green-700 border-green-200 text-[9px]">פעיל</Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {batch.card_name}
                              {batch.bom_version_label ? ` · ${batch.bom_version_label}` : ""}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums">
                            {batch.bom_items_count > 0 ? (
                              <Link
                                href={bomHref(batch.project_id, batch.batch_id)}
                                className="text-brand hover:underline font-medium"
                              >
                                {batch.bom_items_count}
                              </Link>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600 tabular-nums">{fmtDate(batch.opened_at)}</td>
                          <td className="px-3 py-2 text-slate-600 tabular-nums">{fmtDate(batch.closed_at)}</td>
                          <td className="px-3 py-2 text-slate-600 tabular-nums">{fmtDate(batch.updated_at)}</td>
                          <td className="px-3 py-2 text-slate-700">{batch.updated_by_name ?? "—"}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={batch.batch_status} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                href={projectOverviewHref(
                                  batch.project_id,
                                  batch.card_id,
                                  batch.batch_id,
                                )}
                                title="סקירת פרויקט"
                                className="h-7 w-7 rounded-md hover:bg-brand-soft flex items-center justify-center text-slate-500 hover:text-brand"
                              >
                                <LayoutDashboard className="h-3.5 w-3.5" />
                              </Link>
                              <Link
                                href={bomHref(batch.project_id, batch.batch_id)}
                                title="טבלת BOM"
                                className="h-7 w-7 rounded-md hover:bg-brand-soft flex items-center justify-center text-slate-500 hover:text-brand"
                              >
                                <GitBranch className="h-3.5 w-3.5" />
                              </Link>
                              <Link
                                href={`/upload-bom?project_id=${batch.project_id}&card_id=${batch.card_id}&version_id=${batch.batch_id}`}
                                title="טעינת BOM"
                                className="h-7 w-7 rounded-md hover:bg-brand-soft flex items-center justify-center text-slate-500 hover:text-brand"
                              >
                                <Upload className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                type="button"
                                title="מחיקת מנה"
                                onClick={() => openDeleteBatchDialog(batch)}
                                className="h-7 w-7 rounded-md hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600 border border-transparent hover:border-red-200"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>,
                      );
                    }
                  }
                }
                return rows;
              })
            )}
          </tbody>
        </table>
      </Card>

      {editRow && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div dir="rtl" className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 text-[14px] font-semibold text-navy">עריכת פרויקט</div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
              {actionError && (
                <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
                  {actionError}
                </div>
              )}
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">לקוח</label>
                <select
                  value={fCustomer}
                  onChange={(e) => setFCustomer(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.code ? ` (${c.code})` : ""}
                    </option>
                  ))}
                  <option value={NEW_CUSTOMER}>+ לקוח חדש</option>
                </select>
              </div>
              {fCustomer === NEW_CUSTOMER && (
                <div className="grid grid-cols-2 gap-2 rounded-md border border-dashed border-brand/30 bg-brand-soft/30 p-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">שם לקוח חדש *</label>
                    <input
                      value={fNewName}
                      onChange={(e) => setFNewName(e.target.value)}
                      className="w-full h-8 rounded-md border border-slate-200 px-2 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">קוד לקוח</label>
                    <input
                      value={fNewCode}
                      onChange={(e) => setFNewCode(e.target.value)}
                      className="w-full h-8 rounded-md border border-slate-200 px-2 text-[12px]"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">שם פרויקט *</label>
                <input
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">קישור ספריית Google Drive</label>
                <input
                  value={fDriveUrl}
                  onChange={(e) => setFDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] text-slate-600 mb-1">קוד פרויקט *</label>
                  <input
                    value={fCode}
                    onChange={(e) => setFCode(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-slate-600 mb-1">סטטוס פרויקט</label>
                  <select
                    value={fStatus}
                    onChange={(e) => setFStatus(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
                  >
                    {PROJECT_STATUS_OPTIONS.map((sv) => (
                      <option key={sv} value={sv}>
                        {PROJECT_STATUS_LABELS[sv] ?? sv}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                סטטוס הפרויקט מתעדכן אוטומטית לפי כרטיסים — DONE כשאין כרטיסים פעילים.
              </p>
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">תיאור / הערות</label>
                <textarea
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12.5px]"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2">
              <button
                onClick={saveEdit}
                disabled={actionBusy}
                className="h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60"
              >
                {actionBusy ? "שומר..." : "שמירה"}
              </button>
              <button
                onClick={() => setEditRow(null)}
                disabled={actionBusy}
                className="h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] hover:bg-slate-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {editCard && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div dir="rtl" className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 text-[14px] font-semibold text-navy">
              עריכת כרטיס
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
              {actionError && (
                <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
                  {actionError}
                </div>
              )}
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">שם כרטיס *</label>
                <input
                  value={fCardName}
                  onChange={(e) => setFCardName(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">שם לוח / Board</label>
                <input
                  value={fCardBoard}
                  onChange={(e) => setFCardBoard(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] text-slate-600 mb-1">כמות להרכבה (ברירת מחדל)</label>
                  <input
                    type="number"
                    min={1}
                    value={fCardQty}
                    onChange={(e) => setFCardQty(Number(e.target.value))}
                    className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-slate-600 mb-1">סטטוס כרטיס</label>
                  <select
                    value={fCardStatus}
                    onChange={(e) => setFCardStatus(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white"
                  >
                    {CARD_STATUS_OPTIONS.map((sv) => (
                      <option key={sv} value={sv}>
                        {PROJECT_STATUS_LABELS[sv] ?? sv}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                כמות ברירת המחדל חלה על מנות חדשות; כל מנה יכולה לקבל כמות שונה בנפרד.
              </p>
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">הערות</label>
                <textarea
                  value={fCardNotes}
                  onChange={(e) => setFCardNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12.5px]"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-start gap-2">
              <button
                onClick={saveEditCard}
                disabled={actionBusy}
                className="h-9 px-4 rounded-md bg-brand text-brand-fg text-[12.5px] font-medium hover:bg-brand/90 disabled:opacity-60"
              >
                {actionBusy ? "שומר..." : "שמירה"}
              </button>
              <button
                onClick={() => setEditCard(null)}
                disabled={actionBusy}
                className="h-9 px-4 rounded-md border border-slate-200 bg-white text-[12.5px] hover:bg-slate-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {newBatchTarget && (
        <NewBatchDialog
          target={newBatchTarget}
          onClose={() => setNewBatchTarget(null)}
          onCreated={() => {
            void loadWorkspace();
            onReload();
            setNotice("מנה חדשה נוצרה בהצלחה");
          }}
        />
      )}

      {deleteBatchTarget && (
        <DeleteBatchDialog
          target={deleteBatchTarget}
          busy={deleteBatchBusy}
          error={deleteBatchError}
          onClose={() => {
            if (!deleteBatchBusy) setDeleteBatchTarget(null);
          }}
          onConfirm={() => void confirmDeleteBatch()}
        />
      )}
    </>
  );
}
