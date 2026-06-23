export type VersionCatalogItem = {
  id: number;
  project_id: number;
  version_label: string;
  version_name: string | null;
  revision_code: string | null;
  source_file_name: string | null;
  notes: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  imported_at: string | null;
  batch_label: string | null;
  build_quantity: number | null;
  total_lines: number;
  dnp_count: number;
  non_dnp_count: number;
  quality_score: number | null;
  needs_review_count: number;
  pricing_snapshot_count: number;
  is_project_active: boolean;
};

export type VersionCatalogResponse = {
  project_id: number;
  project_name: string;
  customer_name: string | null;
  active_version_id: number | null;
  total_versions: number;
  last_uploaded_at: string | null;
  versions: VersionCatalogItem[];
};

export type CompareSummary = {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  qty_changed: number;
  mpn_changed: number;
  manufacturer_changed: number;
  description_changed: number;
  dnp_changed: number;
  needs_review: number;
};

export type CompareChangeRow = {
  change_type: string;
  change_flags: string[];
  base_line_id: number | null;
  target_line_id: number | null;
  designator: string | null;
  old_mpn: string | null;
  new_mpn: string | null;
  old_manufacturer: string | null;
  new_manufacturer: string | null;
  old_qty: number | null;
  new_qty: number | null;
  old_dnp: boolean | null;
  new_dnp: boolean | null;
  old_description: string | null;
  new_description: string | null;
  notes: string | null;
  needs_review: boolean;
};

export type CompareResponse = {
  project_id: number;
  base_version: { id: number; version_label: string; version_name: string | null };
  target_version: { id: number; version_label: string; version_name: string | null };
  summary: CompareSummary;
  changes: CompareChangeRow[];
};

export type CompareFilterKey =
  | "all"
  | "added"
  | "removed"
  | "changed"
  | "qty"
  | "mpn"
  | "manufacturer"
  | "dnp"
  | "needs_review";

export const COMPARE_FILTERS: { id: CompareFilterKey; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "added", label: "נוספו" },
  { id: "removed", label: "הוסרו" },
  { id: "changed", label: "השתנו" },
  { id: "qty", label: "Qty" },
  { id: "mpn", label: "MPN" },
  { id: "manufacturer", label: "יצרן" },
  { id: "dnp", label: "DNP" },
  { id: "needs_review", label: "דורש בדיקה" },
];

export function versionDisplayName(v: {
  version_name?: string | null;
  batch_label?: string | null;
  version_label: string;
}): string {
  return v.version_name ?? v.batch_label ?? v.version_label;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function changeTypeLabel(type: string): string {
  const map: Record<string, string> = {
    Added: "נוסף",
    Removed: "הוסר",
    Unchanged: "ללא שינוי",
    "Quantity Changed": "שינוי כמות",
    "MPN Changed": "שינוי MPN",
    "Manufacturer Changed": "שינוי יצרן",
    "Description Changed": "שינוי תיאור",
    "DNP Changed": "שינוי DNP",
    Changed: "שונה",
  };
  return map[type] ?? type;
}

export function changeTypeTone(type: string): string {
  if (type === "Added") return "bg-green-50 text-green-800 border-green-200";
  if (type === "Removed") return "bg-red-50 text-red-800 border-red-200";
  if (type === "Unchanged") return "bg-slate-50 text-slate-600 border-slate-200";
  if (type === "DNP Changed") return "bg-slate-100 text-slate-600 border-slate-300";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export function matchesCompareFilter(row: CompareChangeRow, filter: CompareFilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "added") return row.change_flags.includes("Added");
  if (filter === "removed") return row.change_flags.includes("Removed");
  if (filter === "changed")
    return !row.change_flags.includes("Added") && !row.change_flags.includes("Removed") && !row.change_flags.includes("Unchanged");
  if (filter === "qty") return row.change_flags.includes("Quantity Changed");
  if (filter === "mpn") return row.change_flags.includes("MPN Changed");
  if (filter === "manufacturer") return row.change_flags.includes("Manufacturer Changed");
  if (filter === "dnp") return row.change_flags.includes("DNP Changed");
  if (filter === "needs_review") return row.needs_review;
  return true;
}
