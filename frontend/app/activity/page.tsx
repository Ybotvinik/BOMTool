"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, PageHeader, Badge } from "@/components/ui";
import { activity as mockActivity, type ActivityEntry } from "@/lib/mock-data";
import { apiGet } from "@/lib/api";
import { USERS } from "@/lib/users";

type ApiActivity = {
  id: number;
  user_id: number | null;
  action_type: string;
  project_id: number | null;
  entity_type: string | null;
  entity_name: string | null;
  change_summary: string | null;
  created_at: string;
};

const userName = (id: number | null) =>
  USERS.find((u) => u.id === id)?.name ?? (id ? `User #${id}` : "—");

export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityEntry[]>(mockActivity);
  const [live, setLive] = useState(false);

  async function load() {
    try {
      const data = await apiGet<ApiActivity[]>("/api/activity-log");
      if (Array.isArray(data) && data.length > 0) {
        setRows(
          data.map((a) => ({
            id: a.id,
            user: userName(a.user_id),
            actionType: a.action_type,
            project: a.project_id ? `Project #${a.project_id}` : "—",
            entityType: a.entity_type ?? "—",
            entityName: a.entity_name ?? "—",
            summary: a.change_summary ?? "",
            at: a.created_at.replace("T", " ").slice(0, 16),
          })),
        );
        setLive(true);
      }
    } catch {
      setLive(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <PageHeader
        title="יומן פעולות"
        subtitle="תיעוד מלא של כל הפעולות המשמעותיות במערכת (Audit Trail)"
        actions={
          <>
            <span
              className={
                "text-[10px] px-2 py-1 rounded-full border " +
                (live
                  ? "bg-green-50 text-risk-low border-green-200"
                  : "bg-slate-100 text-slate-500 border-slate-200")
              }
            >
              {live ? "● מחובר ל-API" : "○ נתוני דמו"}
            </span>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> רענון
            </button>
          </>
        }
      />
      <Card className="overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-right">
              <th className="px-3 py-2 font-medium">זמן</th>
              <th className="px-3 py-2 font-medium">משתמש</th>
              <th className="px-3 py-2 font-medium">פעולה</th>
              <th className="px-3 py-2 font-medium">ישות</th>
              <th className="px-3 py-2 font-medium">שם</th>
              <th className="px-3 py-2 font-medium">תיאור</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2 text-slate-500 tabular-nums whitespace-nowrap">
                  {a.at}
                </td>
                <td className="px-3 py-2 font-medium">{a.user}</td>
                <td className="px-3 py-2">
                  <Badge className="bg-brand-soft text-brand border-brand/30">
                    {a.actionType}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-600">{a.entityType}</td>
                <td className="px-3 py-2 tabular-nums">{a.entityName}</td>
                <td className="px-3 py-2 text-slate-600">{a.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
