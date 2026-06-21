"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Upload, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ProjectsWorkspace } from "@/components/projects/ProjectsWorkspace";
import { API_URL, apiGet, apiPost } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

export default function ProjectsPage() {
  const { user } = useCurrentUser();
  const [live, setLive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  async function load() {
    try {
      await apiGet("/api/projects");
      setLive(true);
    } catch {
      setLive(false);
    }
  }

  useEffect(() => {
    void load();
  }, [reloadToken]);

  async function createProject() {
    setCreating(true);
    try {
      const customers = await apiGet<{ id: number }[]>("/api/customers");
      const stamp = Date.now().toString().slice(-5);
      const customerId = customers[0]?.id ?? 1;
      await apiPost(
        "/api/projects",
        {
          customer_id: customerId,
          name: `פרויקט חדש ${stamp}`,
          code: `NEW-${stamp}`,
          status: "NEW",
        },
        user.id,
      );
      setReloadToken((x) => x + 1);
    } catch (e) {
      alert("יצירת פרויקט נכשלה — ודא שה-API פעיל. " + String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PageHeader
        title="פרויקטים"
        subtitle="עץ לקוחות → פרויקטים → כרטיסים → מנות הרכבה"
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
              onClick={() => setReloadToken((x) => x + 1)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> רענון
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

      <ProjectsWorkspace live={live} onReload={() => setReloadToken((x) => x + 1)} />
    </>
  );
}
