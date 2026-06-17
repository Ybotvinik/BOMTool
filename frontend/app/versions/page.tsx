"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { PageTabs } from "@/components/PageTabs";
import { Placeholder } from "@/components/Placeholder";

const VERSION_TABS = [
  { id: "versions", label: "גרסאות BOM" },
  { id: "changes", label: "השוואת שינויים" },
] as const;

type VersionTab = (typeof VERSION_TABS)[number]["id"];

function VersionsInner() {
  const params = useSearchParams();
  const activeTab = (params.get("tab") as VersionTab) || "versions";
  const projectId = params.get("project_id");

  const tabQuery = projectId ? { project_id: projectId } : undefined;

  return (
    <>
      <PageHeader title="גרסאות" subtitle="ניהול גרסאות BOM והשוואת שינויים" />
      <PageTabs tabs={[...VERSION_TABS]} activeTab={activeTab} basePath="/versions" query={tabQuery} />

      {activeTab === "versions" ? (
        <Placeholder title="גרסאות BOM" subtitle="ניהול גרסאות BOM של הפרויקט" />
      ) : (
        <Placeholder title="השוואת שינויים" subtitle="השוואה בין גרסאות BOM" />
      )}
    </>
  );
}

export default function VersionsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <VersionsInner />
    </Suspense>
  );
}
