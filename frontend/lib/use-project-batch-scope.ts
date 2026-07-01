"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import {
  resolveOverviewSelection,
  type OverviewBatch,
  type OverviewCard,
  type ProjectOverviewContext,
} from "@/lib/project-overview";

export function useProjectBatchScope(
  projectId: number | null,
  urlCardId: string | null,
  urlVersionId: string | null,
) {
  const [overview, setOverview] = useState<ProjectOverviewContext | null>(null);
  const [cardId, setCardId] = useState<number | null>(null);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (projectId == null) {
      setOverview(null);
      setCardId(null);
      setVersionId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ov = await apiGet<ProjectOverviewContext>(`/api/projects/${projectId}/overview`);
      setOverview(ov);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
      setOverview(null);
      setCardId(null);
      setVersionId(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!overview) {
      setCardId(null);
      setVersionId(null);
      return;
    }
    const sel = resolveOverviewSelection(overview, urlCardId, urlVersionId);
    setCardId(sel.cardId);
    setVersionId(sel.versionId);
  }, [overview, urlCardId, urlVersionId]);

  const selectedCard = useMemo<OverviewCard | null>(
    () => overview?.cards.find((c) => c.id === cardId) ?? null,
    [overview, cardId],
  );

  const selectedBatch = useMemo<OverviewBatch | null>(
    () => selectedCard?.batches.find((b) => b.id === versionId) ?? null,
    [selectedCard, versionId],
  );

  function defaultBatchForCard(nextCardId: number): number | null {
    const card = overview?.cards.find((c) => c.id === nextCardId);
    if (!card?.batches.length) return null;
    const activeOnCard = card.batches.find((b) => b.is_project_active);
    return (activeOnCard ?? card.batches[card.batches.length - 1]).id;
  }

  return {
    overview,
    cardId,
    versionId,
    selectedCard,
    selectedBatch,
    loading,
    error,
    reload: loadOverview,
    defaultBatchForCard,
    setCardId,
    setVersionId,
  };
}
