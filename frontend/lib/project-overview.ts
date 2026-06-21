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

export function resolveOverviewSelection(
  overview: ProjectOverviewContext,
  cardIdParam: string | null,
  versionIdParam: string | null,
): { cardId: number | null; versionId: number | null } {
  const parsedVersionId = versionIdParam ? Number(versionIdParam) : null;
  if (parsedVersionId != null && Number.isFinite(parsedVersionId)) {
    for (const card of overview.cards) {
      if (card.batches.some((b) => b.id === parsedVersionId)) {
        return { cardId: card.id, versionId: parsedVersionId };
      }
    }
  }

  const parsedCardId = cardIdParam ? Number(cardIdParam) : null;
  if (parsedCardId != null && Number.isFinite(parsedCardId)) {
    const card = overview.cards.find((c) => c.id === parsedCardId);
    if (card?.batches.length) {
      const batch =
        card.batches.find((b) => b.is_project_active) ??
        card.batches[card.batches.length - 1];
      return { cardId: card.id, versionId: batch.id };
    }
    return { cardId: parsedCardId, versionId: null };
  }

  if (overview.active_version_id != null) {
    for (const card of overview.cards) {
      const batch = card.batches.find((b) => b.id === overview.active_version_id);
      if (batch) return { cardId: card.id, versionId: batch.id };
    }
  }

  for (const card of overview.cards) {
    if (card.batches.length) {
      return {
        cardId: card.id,
        versionId: card.batches[card.batches.length - 1].id,
      };
    }
  }

  if (overview.cards.length) {
    return { cardId: overview.cards[0].id, versionId: null };
  }

  return { cardId: null, versionId: null };
}
