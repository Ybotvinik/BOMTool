"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Upload, FolderOpen, RefreshCw } from "lucide-react";
import { Card, PageHeader, Kpi, StatusBadge, Badge } from "@/components/ui";
import { projects as mockProjects, type Project } from "@/lib/mock-data";
import { API_URL, apiGet, apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = {
  id: number;
  name: string;
  code: string;
  status: string;
  build_quantity: number;
  customer_id: number;
};

const fmt = (n: number) => `$${n.toLocaleString()}`;

export default function ProjectsPage() {
  const { user } = useCurrentUser();
  const [rows, setRows] = useState<Project[]>(mockProjects);
  const [live, setLive] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const data = await apiGet<ApiProject[]>("/api/projects");
      if (Array.isArray(data) && data.length > 0) {
        setRows(
          data.map((p) => ({
            id: p.id,
            customer: `Customer #${p.customer_id}`,
            name: p.name,
            code: p.code,
            activeVersion: "—",
            status: (p.status as Project["status"]) ?? "Active",
            customerValue: 0,
            internalCost: 0,
            critical: 0,
            needsReview: 0,
            lastUpdated: new Date().toISOString().slice(0, 10),
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

  async function createProject() {
    setCreating(true);
    try {
      const stamp = Date.now().toString().slice(-5);
      await apiPost(
        "/api/projects",
        {
          customer_id: 1,
          name: `פרויקט חדש ${stamp}`,
          code: `NEW-${stamp}`,
          build_quantity: 100,
          status: "Active",
        },
        user.id,
      );
      await load();
    } catch (e) {
      alert("יצירת פרויקט נכשלה — ודא שה-API פעיל. " + String(e));
    } finally {
      setCreating(false);
    }
  }

  const total = rows.length;
  const active = rows.filter(
    (p) => p.status === "Active" || p.status === "Quoting",
  ).length;
  const inReview = rows.filter((p) => p.status === "In Review").length;
  const criticalTotal = rows.reduce((s, p) => s + p.critical, 0);

  return (
    <>
      <PageHeader
        title="פרויקטים"
        subtitle="ניהול פרויקטי לקוח, גרסאות BOM ועלויות רכש"
        actions={
          <>
            <span
              className={
                "text-[10px] px-2 py-1 rounded-full border " +
                (live
                  ? "bg-green-50 text-risk-low border-green-200"
                  : "bg-slate-100 text-slate-500 border-slate-200")
              }
              title={`API: ${API_URL}`}
            >
              {live ? "● מחובר ל-API" : "○ נתוני דמו"}
            </span>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> רענון
            </button>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50">
              <FolderOpen className="h-3.5 w-3.5" /> פתיחת תיקיית Drive
            </button>
            <Link
              href="/upload-bom"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50"
            >
              <Upload className="h-3.5 w-3.5" /> טעינת BOM
            </Link>
            <button
              onClick={createProject}
              disabled={creating}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" /> {creating ? "יוצר..." : "פרויקט חדש"}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <Kpi label="סה״כ פרויקטים" value={total} />
        <Kpi label="פרויקטים פעילים" value={active} tone="good" />
        <Kpi label="BOMs בבדיקה" value={inReview} tone="warn" />
        <Kpi label="רכיבים קריטיים" value={criticalTotal} tone="bad" />
        <Kpi label="דוחות שהופקו החודש" value={18} hint="יוני 2026" />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-right">
              <th className="px-3 py-2 font-medium">לקוח</th>
              <th className="px-3 py-2 font-medium">שם פרויקט</th>
              <th className="px-3 py-2 font-medium">קוד פרויקט</th>
              <th className="px-3 py-2 font-medium">גרסת BOM פעילה</th>
              <th className="px-3 py-2 font-medium">סטטוס</th>
              <th className="px-3 py-2 font-medium">Customer BOM Value</th>
              <th className="px-3 py-2 font-medium">Internal Cost</th>
              <th className="px-3 py-2 font-medium text-center">Critical Parts</th>
              <th className="px-3 py-2 font-medium">עודכן לאחרונה</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-t border-slate-100 hover:bg-slate-50/60"
              >
                <td className="px-3 py-2 font-medium">{p.customer}</td>
                <td className="px-3 py-2">
                  <Link
                    href="/project"
                    className="text-brand hover:underline font-medium"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-500 tabular-nums">{p.code}</td>
                <td className="px-3 py-2 tabular-nums">{p.activeVersion}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-3 py-2 tabular-nums">{fmt(p.customerValue)}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(p.internalCost)}</td>
                <td className="px-3 py-2 text-center">
                  {p.critical > 0 ? (
                    <Badge className="bg-red-50 text-risk-critical border-red-200">
                      {p.critical}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500 tabular-nums">
                  {p.lastUpdated}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
