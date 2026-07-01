export type OverviewBatch = {
  id: number;
  batch_label: string | null;
  version_label: string;
  version_name: string | null;
  status: string;
  build_quantity: number | null;
  bom_items_count: number;
  is_project_active: boolean;
};

export type OverviewCard = {
  id: number;
  name: string;
  board_name: string | null;
  status: string;
  build_quantity: number;
  batches: OverviewBatch[];
};

export type ProjectOverviewContext = {
  customer_id: number;
  customer_name: string;
  project_id: number;
  project_name: string;
  project_code: string;
  project_status: string;
  active_version_id: number | null;
  cards: OverviewCard[];
};

export function projectOverviewHref(
  projectId: number,
  cardId?: number | null,
  versionId?: number | null,
) {
  const q = new URLSearchParams({ project_id: String(projectId) });
  if (cardId != null) q.set("card_id", String(cardId));
  if (versionId != null) q.set("version_id", String(versionId));
  return `/project?${q.toString()}`;
}

export function formatBatchLabel(batch: OverviewBatch): string {
  const label = batch.batch_label?.trim() || "";
  const versionName = batch.version_name?.trim() || "";
  const versionLabel = batch.version_label?.trim() || "";

  if (label && versionName && label !== versionName) {
    return `${label} · ${versionName}`;
  }
  if (label) return label;
  if (versionName) return versionName;
  if (versionLabel) return versionLabel;
  return `מנה #${batch.id}`;
}

export function resolveOverviewSelection(
  overview: ProjectOverviewContext,
  cardIdParam: string | null,
  versionIdParam: string | null,
): { cardId: number | null; versionId: number | null } {
  const parsedCardId = cardIdParam ? Number(cardIdParam) : null;
  const parsedVersionId = versionIdParam ? Number(versionIdParam) : null;

  const defaultBatchForCard = (cardId: number) => {
    const card = overview.cards.find((c) => c.id === cardId);
    if (!card?.batches.length) return null;
    const activeOnCard = card.batches.find((b) => b.is_project_active);
    return (activeOnCard ?? card.batches[card.batches.length - 1]).id;
  };

  // Both card + version in URL — honour card; version only if it belongs to that card.
  if (parsedCardId != null && Number.isFinite(parsedCardId)) {
    const card = overview.cards.find((c) => c.id === parsedCardId);
    if (!card) return { cardId: parsedCardId, versionId: null };

    if (parsedVersionId != null && Number.isFinite(parsedVersionId)) {
      if (card.batches.some((b) => b.id === parsedVersionId)) {
        return { cardId: card.id, versionId: parsedVersionId };
      }
      const fallback = defaultBatchForCard(card.id);
      return { cardId: card.id, versionId: fallback };
    }

    const batchId = defaultBatchForCard(card.id);
    return { cardId: card.id, versionId: batchId };
  }

  if (parsedVersionId != null && Number.isFinite(parsedVersionId)) {
    for (const card of overview.cards) {
      if (card.batches.some((b) => b.id === parsedVersionId)) {
        return { cardId: card.id, versionId: parsedVersionId };
      }
    }
  }

  if (overview.active_version_id != null) {
    for (const card of overview.cards) {
      const batch = card.batches.find((b) => b.id === overview.active_version_id);
      if (batch) return { cardId: card.id, versionId: batch.id };
    }
  }

  for (const card of overview.cards) {
    if (card.batches.length) {
      return { cardId: card.id, versionId: card.batches[card.batches.length - 1].id };
    }
  }

  if (overview.cards.length) {
    return { cardId: overview.cards[0].id, versionId: null };
  }

  return { cardId: null, versionId: null };
}
