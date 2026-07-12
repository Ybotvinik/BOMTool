"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { CardBatchScopeBar } from "@/components/project/CardBatchScopeBar";
import { OfficialPricingExportPanel } from "@/components/official-pricing/OfficialPricingExportPanel";
import { apiGet } from "@/lib/api";
import { formatBatchLabel } from "@/lib/project-overview";
import { useProjectBatchScope } from "@/lib/use-project-batch-scope";
import { useCurrentUser } from "@/lib/current-user";

type ApiProject = { id: number; name: string; code: string };

function ExportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("project_id");
  const urlCardId = searchParams.get("card_id");
  const urlVersionId =
    searchParams.get("version_id") ?? searchParams.get("bom_version_id");
  const { user } = useCurrentUser();

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ApiProject[]>("/api/projects")
      .then((ps) => {
        setProjects(ps);
        if (!ps.length) return;
        if (urlProjectId) {
          const fromUrl = ps.find((p) => String(p.id) === urlProjectId);
          if (fromUrl) {
            setProjectId(fromUrl.id);
            return;
          }
        }
        setProjectId(ps[0].id);
      })
      .catch(() => setError("לא ניתן לטעון פרויקטים"));
  }, [urlProjectId]);

  const scope = useProjectBatchScope(projectId, urlCardId, urlVersionId);

  useEffect(() => {
    if (scope.loading || projectId == null) return;

    const needsCard = !urlCardId && scope.cardId != null;
    const needsVersion = !urlVersionId && scope.versionId != null;
    const legacyVersionParam =
      searchParams.has("bom_version_id") && !searchParams.has("version_id");

    if (needsCard || needsVersion || legacyVersionParam) {
      const q = new URLSearchParams(searchParams.toString());
      q.set("project_id", String(projectId));
      if (scope.cardId != null) q.set("card_id", String(scope.cardId));
      if (scope.versionId != null) {
        q.set("version_id", String(scope.versionId));
      }
      q.delete("bom_version_id");
      router.replace(`/export?${q.toString()}`);
    }
  }, [
    scope.loading,
    scope.cardId,
    scope.versionId,
    projectId,
    urlCardId,
    urlVersionId,
    searchParams,
    router,
  ]);

  function pushScope(next: { cardId: number; versionId: number | null }) {
    if (projectId == null) return;
    const q = new URLSearchParams(searchParams.toString());
    q.set("project_id", String(projectId));
    q.set("card_id", String(next.cardId));
    if (next.versionId != null) q.set("version_id", String(next.versionId));
    else q.delete("version_id");
    q.delete("bom_version_id");
    router.replace(`/export?${q.toString()}`);
  }

  function selectCard(cardId: number) {
    const batchId = scope.defaultBatchForCard(cardId);
    pushScope({ cardId, versionId: batchId });
  }

  function selectBatch(batchId: number) {
    const card = scope.overview?.cards.find((c) => c.batches.some((b) => b.id === batchId));
    if (!card) return;
    pushScope({ cardId: card.id, versionId: batchId });
  }

  function selectProject(nextProjectId: number) {
    setProjectId(nextProjectId);
    const q = new URLSearchParams();
    q.set("project_id", String(nextProjectId));
    router.replace(`/export?${q.toString()}`);
  }

  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  const versionLabel = scope.selectedBatch
    ? formatBatchLabel(scope.selectedBatch)
    : undefined;

  return (
    <>
      <PageHeader
        title="דוחות וייצוא"
        subtitle="הפקת קבצי Excel — דוחות ללקוח, פנימיים ורכש"
      />

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
          {error}
        </div>
      )}

      {scope.error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] px-3 py-2">
          {scope.error}
        </div>
      )}

      <CardBatchScopeBar
        overview={scope.overview}
        cardId={scope.cardId}
        versionId={scope.versionId}
        loading={scope.loading}
        onCardChange={selectCard}
        onBatchChange={selectBatch}
        projects={projects}
        projectId={projectId}
        onProjectChange={selectProject}
      />

      <OfficialPricingExportPanel
        projectId={projectId}
        versionId={scope.versionId}
        projectName={selectedProject?.name}
        versionLabel={versionLabel}
        userId={user.id}
        showWorkbenchExport
      />
    </>
  );
}

export default function ExportPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <ExportInner />
    </Suspense>
  );
}
