export type SupplierOffer = {
  supplier: string;
  supplier_display: string;
  supplier_part_number: string | null;
  manufacturer: string | null;
  unit_price: number | null;
  extended_price: number | null;
  stock: number | null;
  price_break_qty: number | null;
  match_status: string | null;
  match_reason: string | null;
  is_exact_match: boolean;
  product_url: string | null;
  lead_time: string | null;
  currency: string;
  needs_review: boolean;
};

export type WorkbenchLine = {
  bom_line_id: number;
  line_no: number | null;
  mpn: string | null;
  cleaned_mpn: string | null;
  search_mpn: string | null;
  search_mpn_override: string | null;
  search_mpn_override_active: boolean;
  manufacturer: string | null;
  description: string | null;
  required_qty: number | null;
  dnp: boolean;
  source: string;
  supplier_part_number: string | null;
  unit_price: number | null;
  extended_price: number | null;
  stock: number | null;
  currency: string;
  lead_time: string | null;
  status: string;
  solution_status: string;
  notes: string | null;
  selected_supplier: string | null;
  selected_source_type: string | null;
  user_selected: boolean;
  offers: SupplierOffer[];
};

export type WorkbenchSummary = {
  total_lines: number;
  has_solution: number;
  needs_approval: number;
  no_solution: number;
  dnp: number;
  selected_total_cost: number;
};

export type ConfigStatus = {
  digikey: { configured: boolean; credentials_missing: boolean; env: string; mode: string };
  mouser: { configured: boolean; credentials_missing: boolean; mode: string };
  mock_mode: boolean;
  mock_allow_export: boolean;
};

export const FILTERS = [
  ["all", "הכל"],
  ["dnp", "DNP"],
  ["manual", "Manual"],
  ["has_solution", "Has Solution"],
  ["no_stock", "No Stock"],
  ["needs_review", "Needs Review"],
] as const;

export type FilterKey = (typeof FILTERS)[number][0];

export function matchesFilter(line: WorkbenchLine, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "needs_review") return line.status === "Needs Review";
  if (filter === "no_stock") return line.status === "No Stock";
  if (filter === "has_solution") return line.solution_status === "Has Solution";
  if (filter === "manual") return line.status === "Manual";
  if (filter === "dnp") return line.status === "DNP";
  return true;
}

export function fmtPrice(v: number | null | undefined, currency = "USD") {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);
}
