import type { QualityLine } from "@/components/EditBomLineModal";

export type BomSummary = {
  total_lines?: number;
  ok_count?: number;
  warning_count?: number;
  error_count?: number;
  needs_review_count?: number;
  missing_mpn_count?: number;
  missing_qty_count?: number;
  missing_manufacturer_count?: number;
  missing_description_count?: number;
  dnp_count?: number;
  duplicate_mpn_count?: number;
  duplicate_refdes_count?: number;
  quality_score?: number;
};

export type BomVersionMeta = {
  id: number;
  project_id: number;
  version_label: string;
  version_name: string | null;
  revision_code: string | null;
  source_doc_number: string | null;
  board_name: string | null;
  source_file_name: string | null;
  revised_date: string | null;
  build_quantity: number | null;
  status: string;
  is_active: boolean;
};

export type BomProjectMeta = {
  id: number;
  name: string;
  code: string;
  customer_id: number;
  active_version_id: number | null;
};

export const BOM_FILTERS = [
  ["all", "הכל"],
  ["open", "דורש טיפול"],
  ["corrected", "תוקן"],
  ["reviewed", "נבדק"],
  ["ok", "OK"],
  ["error", "Errors"],
  ["warning", "Warnings"],
  ["needs_review", "Needs Review"],
  ["dnp", "DNP"],
  ["missing_mpn", "Missing MPN"],
  ["missing_qty", "Missing Qty"],
] as const;

export type BomFilterKey = (typeof BOM_FILTERS)[number][0];

export function matchesBomFilter(line: QualityLine, filter: BomFilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "open") return line.review_status === "open" || (line.needs_review && line.review_status !== "reviewed" && line.review_status !== "corrected");
  if (filter === "corrected") return line.review_status === "corrected" || line.has_correction === true;
  if (filter === "reviewed") return line.review_status === "reviewed" || line.quality_reviewed === true;
  if (filter === "ok") return line.quality_status === "ok" && !line.needs_review;
  if (filter === "error") return line.quality_status === "error";
  if (filter === "warning") return line.quality_status === "warning";
  if (filter === "needs_review") return line.needs_review;
  if (filter === "dnp") return line.is_dnp;
  if (filter === "missing_mpn") return (line.review_reason ?? "").includes("Missing MPN");
  if (filter === "missing_qty") return (line.review_reason ?? "").includes("Missing Qty");
  return true;
}

export function qualityScoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 90) return "good";
  if (score >= 70) return "warn";
  return "bad";
}

export function qualityScoreLabel(score: number): string {
  if (score >= 90) return "איכות טובה";
  if (score >= 70) return "דורש בדיקה";
  return "איכות נמוכה";
}
