export type SupplierOffer = {
  supplier: string;
  supplier_display: string;
  mpn?: string | null;
  matched_mpn?: string | null;
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
  internal_only?: boolean;
  source_type?: string | null;
  source_group?: string | null;
  comments?: string | null;
  total_price?: number | null;
  is_currently_selected?: boolean;
  is_recommended?: boolean;
  delta_vs_selected?: number | null;
  delta_vs_official_best?: number | null;
  savings_vs_official?: number | null;
  disabled_in_current_mode?: boolean;
  disabled_reason?: string | null;
};

export type LinePricingComparison = {
  official_best_extended: number | null;
  east_best_extended: number | null;
  difference: number | null;
  difference_percent: number | null;
  has_official_price: boolean;
  has_east_price: boolean;
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
  source_is_internal?: boolean;
  east_pricing_disabled_note?: string | null;
  line_pricing?: LinePricingComparison | null;
  recommended_supplier?: string | null;
  recommended_internal_only?: boolean;
};

export type PricingScenarioStats = {
  total: number;
  priced_lines: number;
  needs_approval: number;
  no_solution: number;
  no_stock: number;
  east_selected_lines: number;
};

export type PricingComparison = {
  official_only: PricingScenarioStats;
  with_east: PricingScenarioStats;
  savings: {
    amount: number;
    percent: number | null;
    is_saving: boolean;
  };
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
  ti: { configured: boolean; credentials_missing: boolean; mode: string };
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

function priceFractionDigits(v: number): number {
  const abs = Math.abs(v);
  if (abs === 0) return 2;
  let digits = 2;
  while (digits < 8) {
    if (Math.round(abs * 10 ** digits) !== 0) return digits;
    digits += 1;
  }
  return 8;
}

export function fmtPrice(v: number | null | undefined, currency = "USD") {
  if (v == null) return "—";
  const fractionDigits = priceFractionDigits(v);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(v);
}
