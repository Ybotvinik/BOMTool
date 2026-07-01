export type PurchaseFileLine = {
  bom_line_id: number;
  line_number: number | null;
  supplier: string | null;
  source: string | null;
  source_type: string | null;
  internal_only: boolean;
  mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  designators: string | null;
  required_qty: number | null;
  supplier_part_number: string | null;
  unit_price: number | null;
  extended_price: number | null;
  currency: string;
  stock: number | null;
  lead_time: string | null;
  status: string | null;
  solution_status: string | null;
  notes: string | null;
  match_reason: string | null;
  needs_handling: boolean;
  offers: import("@/components/official-pricing/types").SupplierOffer[];
};

export type PurchaseFileResponse = {
  project: { id: number; name: string; code: string; customer_name: string | null };
  bom_version: {
    id: number;
    version_label: string;
    version_name: string | null;
    build_quantity: number | null;
    is_active: boolean;
    is_project_active: boolean;
  };
  pricing_mode: string;
  include_east: boolean;
  supplier_filter: string;
  snapshot_id: number | null;
  snapshot_name: string | null;
  generated_at: string;
  summary: {
    grand_total: number;
    ready_lines: number;
    needs_approval: number;
    no_stock: number;
    no_solution: number;
    needs_handling: number;
    dnp_excluded: number;
    purchase_lines: number;
  };
  supplier_summaries: {
    supplier: string;
    supplier_key: string;
    source_type: string | null;
    internal_only: boolean;
    lines_count: number;
    total: number;
    needs_approval: number;
    no_stock: number;
    no_solution: number;
    lead_time_summary: string | null;
  }[];
  lines: PurchaseFileLine[];
  needs_handling_lines: PurchaseFileLine[];
  available_snapshots: { id: number; snapshot_name: string; created_at: string }[];
};

export const SUPPLIER_FILTERS = [
  { value: "all", label: "כל הספקים" },
  { value: "digikey", label: "Digi-Key" },
  { value: "mouser", label: "Mouser" },
  { value: "ti", label: "TI" },
  { value: "china", label: "סין / מזרח" },
  { value: "manual", label: "Manual" },
  { value: "tbd", label: "TBD / No Solution" },
] as const;

export type SupplierFilter = (typeof SUPPLIER_FILTERS)[number]["value"];

export function fmtMoney(v: number | null | undefined, currency = "USD"): string {
  if (v == null) return "—";
  return `${currency} ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function versionLabel(v: { version_name: string | null; version_label: string }): string {
  return v.version_name ?? v.version_label;
}
