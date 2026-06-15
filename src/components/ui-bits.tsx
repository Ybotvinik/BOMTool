import { Card, CardContent } from "@/components/ui/card";

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneCls = {
    default: "text-foreground",
    good: "text-risk-low",
    warn: "text-risk-high",
    bad: "text-risk-critical",
  }[tone];
  return (
    <Card className="border-border/60 py-0">
      <CardContent className="p-3">
        <div className="text-[11px] text-muted-foreground mb-0.5 leading-tight">{label}</div>
        <div className={`text-[22px] font-semibold leading-tight ${toneCls}`}>{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{hint}</div>}
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
    <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-1.5 flex-wrap">{actions}</div>}
    </div>
  );
}
