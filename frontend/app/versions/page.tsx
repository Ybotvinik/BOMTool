"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageTabs } from "@/components/PageTabs";
import { BomComparePanel } from "@/components/versions/BomComparePanel";
import {
  BomVersionsPanel,
  readSavedProjectId,
  saveProjectId,
} from "@/components/versions/BomVersionsPanel";
import { apiGet } from "@/lib/api";
import { useProjectBatchScope } from "@/lib/use-project-batch-scope";

const VERSION_TABS = [
  { id: "versions", label: "גרסאות BOM" },
  { id: "changes", label: "השוואת שינויים" },
] as const;

type VersionTab = (typeof VERSION_TABS)[number]["id"];

type ApiProject = { id: number; name: string };

function VersionsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const activeTab = (params.get("tab") as VersionTab) || "versions";
  const urlProjectId = params.get("project_id");
  const urlCardId = params.get("card_id");
  const urlBaseId = params.get("base_version_id");
  const urlTargetId = params.get("target_version_id");

  const [projectId, setProjectId] = useState<number | null>(null);

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects").then((ps) => {
      if (!ps.length) return;
      let next: number | null = null;
      if (urlProjectId) {
        const fromUrl = ps.find((p) => String(p.id) === urlProjectId);
        if (fromUrl) next = fromUrl.id;
      }
      if (next == null) {
        const saved = readSavedProjectId();
        if (saved != null && ps.some((p) => p.id === saved)) next = saved;
      }
      if (next == null) next = ps[0].id;
      setProjectId(next);
    });
  }, [urlProjectId]);

  const scope = useProjectBatchScope(projectId, urlCardId, null);

  useEffect(() => {
    if (scope.loading || projectId == null || activeTab !== "changes") return;
    if (!urlCardId && scope.cardId != null) {
      const next = new URLSearchParams(params.toString());
      next.set("project_id", String(projectId));
      next.set("card_id", String(scope.cardId));
      next.set("tab", "changes");
      router.replace(`/versions?${next.toString()}`);
    }
  }, [scope.loading, scope.cardId, projectId, urlCardId, activeTab, params, router]);

  const syncUrl = useCallback(
    (patch: {
      tab?: VersionTab;
      projectId?: number;
      cardId?: number | null;
      baseVersionId?: number | null;
      targetVersionId?: number | null;
    }) => {
      const next = new URLSearchParams(params.toString());
      const tab = patch.tab ?? activeTab;
      if (tab !== "versions") next.set("tab", tab);
      else next.delete("tab");

      const pid = patch.projectId ?? projectId;
      if (pid != null) next.set("project_id", String(pid));
      else next.delete("project_id");

      const cid = patch.cardId !== undefined ? patch.cardId : scope.cardId;
      if (cid != null) next.set("card_id", String(cid));
      else next.delete("card_id");

      if (patch.baseVersionId != null) next.set("base_version_id", String(patch.baseVersionId));
      else if (patch.baseVersionId === null) next.delete("base_version_id");
      if (patch.targetVersionId != null) next.set("target_version_id", String(patch.targetVersionId));
      else if (patch.targetVersionId === null) next.delete("target_version_id");

      router.replace(`/versions?${next.toString()}`);
    },
    [activeTab, params, projectId, router, scope.cardId],
  );

  function handleProjectChange(id: number) {
    saveProjectId(id);
    setProjectId(id);
    syncUrl({ projectId: id, cardId: null });
  }

  function handleCardChange(cardId: number) {
    syncUrl({ tab: "changes", cardId, baseVersionId: null, targetVersionId: null });
  }

  function handleCompareWith(targetVersionId: number, cardIdForVersion?: number | null) {
    saveProjectId(projectId!);
    const q = new URLSearchParams();
    q.set("tab", "changes");
    q.set("project_id", String(projectId));
    if (cardIdForVersion != null) q.set("card_id", String(cardIdForVersion));
    else if (scope.cardId != null) q.set("card_id", String(scope.cardId));
    q.set("target_version_id", String(targetVersionId));
    router.push(`/versions?${q.toString()}`);
  }

  const tabQuery: Record<string, string | number | null | undefined> = {
    project_id: projectId,
    card_id: scope.cardId,
  };
  if (urlBaseId) tabQuery.base_version_id = urlBaseId;
  if (urlTargetId) tabQuery.target_version_id = urlTargetId;

  return (
    <div className="flex flex-col gap-1 min-h-0 h-[calc(100vh-7rem)] overflow-hidden -mt-2">
      <div className="shrink-0">
        <h1 className="text-[15px] font-bold text-navy tracking-tight leading-none">גרסאות</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">ניהול גרסאות BOM והשוואת שינויים</p>
      </div>

      <PageTabs
        tabs={[...VERSION_TABS]}
        activeTab={activeTab}
        basePath="/versions"
        query={tabQuery}
      />

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeTab === "versions" ? (
          <BomVersionsPanel
            projectId={projectId}
            onProjectChange={handleProjectChange}
            onCompareWith={handleCompareWith}
          />
        ) : (
          <BomComparePanel
            projectId={projectId}
            onProjectChange={handleProjectChange}
            overview={scope.overview}
            cardId={scope.cardId}
            onCardChange={handleCardChange}
            initialBaseId={urlBaseId ? Number(urlBaseId) : null}
            initialTargetId={urlTargetId ? Number(urlTargetId) : null}
          />
        )}
      </div>
    </div>
  );
}

export default function VersionsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <VersionsInner />
    </Suspense>
  );
}
