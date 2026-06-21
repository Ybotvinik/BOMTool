const CONTEXT_KEY = "glintech.officialPricing.context";

type SavedContext = {
  projectId: number;
  versionId?: number;
};

function readRaw(): SavedContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedContext;
    if (!parsed?.projectId || !Number.isFinite(parsed.projectId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readLastOfficialPricingProjectId(): number | null {
  return readRaw()?.projectId ?? null;
}

export function readLastOfficialPricingVersionId(projectId: number): number | null {
  const saved = readRaw();
  if (!saved || saved.projectId !== projectId) return null;
  const versionId = saved.versionId;
  return versionId != null && Number.isFinite(versionId) ? versionId : null;
}

export function saveOfficialPricingContext(projectId: number, versionId?: number | null) {
  if (typeof window === "undefined") return;
  const payload: SavedContext = { projectId };
  if (versionId != null) payload.versionId = versionId;
  window.localStorage.setItem(CONTEXT_KEY, JSON.stringify(payload));
}
