import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, ShieldCheck } from "lucide-react";

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad" | "info" | "internal";
}) {
  const toneCls = {
    default: "text-foreground",
    good: "text-risk-low",
    warn: "text-risk-high",
    bad: "text-risk-critical",
    info: "text-brand",
    internal: "text-amber-700",
  }[tone];
  return (
    <Card className="border-border/60 py-0">
      <CardContent className="p-2.5">
        <div className="text-[11px] text-muted-foreground mb-0.5 leading-tight truncate">{label}</div>
        <div className={`text-[22px] font-semibold leading-tight tabular-nums ${toneCls}`}>{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight truncate">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-1.5 flex-wrap">{actions}</div>}
    </div>
  );
}

/** Consistent status badge across the app. */
export type StatusKey =
  | "Exact Match"
  | "Partial Match"
  | "Description Updated"
  | "Needs Review"
  | "Conflict"
  | "Critical"
  | "Obsolete"
  | "DNP"
  | "Customer Safe"
  | "GlinTech Internal Only"
  | "Use China Price"
  | "Request Approval"
  | "Request Requote"
  | "Active"
  | "Archived"
  | "Superseded"
  | "Approved"
  | "Draft"
  | "EOL";

const STATUS_TONE: Record<StatusKey, string> = {
  "Exact Match": "bg-risk-low/15 text-risk-low border-risk-low/30",
  "Partial Match": "bg-brand/10 text-brand border-brand/30",
  "Description Updated": "bg-muted text-foreground border-border",
  "Needs Review": "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Conflict: "bg-risk-critical/15 text-risk-critical border-risk-critical/30",
  Critical: "bg-risk-critical/15 text-risk-critical border-risk-critical/30",
  Obsolete: "bg-zinc-900/90 text-white border-zinc-900",
  DNP: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  "Customer Safe": "bg-risk-low/15 text-risk-low border-risk-low/30",
  "GlinTech Internal Only": "bg-amber-500/15 text-amber-700 border-amber-500/40",
  "Use China Price": "bg-risk-low/15 text-risk-low border-risk-low/30",
  "Request Approval": "bg-amber-500/15 text-amber-700 border-amber-500/30",
  "Request Requote": "bg-orange-500/15 text-orange-700 border-orange-500/30",
  Active: "bg-risk-low/15 text-risk-low border-risk-low/30",
  Archived: "bg-muted/60 text-muted-foreground border-border",
  Superseded: "bg-muted text-muted-foreground border-border",
  Approved: "bg-risk-low/15 text-risk-low border-risk-low/30",
  Draft: "bg-muted text-muted-foreground border-border",
  EOL: "bg-zinc-900/90 text-white border-zinc-900",
};

export function StatusBadge({ status }: { status: StatusKey | string }) {
  const cls = STATUS_TONE[status as StatusKey] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`${cls} font-medium`}>
      {status}
    </Badge>
  );
}

/** Customer-safe / internal-only banner. */
export function ScopeBanner({ scope }: { scope: "customer" | "internal" }) {
  if (scope === "customer") {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-risk-low/30 bg-risk-low/10 px-2 py-1 text-[11px] font-semibold text-risk-low">
        <ShieldCheck className="h-3 w-3" /> CUSTOMER SAFE
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-700">
      <Lock className="h-3 w-3" /> GLINTECH INTERNAL ONLY
    </div>
  );
}

/** Compact empty state. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 border border-dashed rounded-lg bg-muted/20">
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-[13px] font-semibold mb-1">{title}</div>
      {description && <div className="text-[11px] text-muted-foreground max-w-sm">{description}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Compact section title block. */
export function SectionTitle({
  title,
  hint,
  actions,
}: {
  title: string;
  hint?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div>
        <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {actions && <div className="flex gap-1.5">{actions}</div>}
    </div>
  );
}
