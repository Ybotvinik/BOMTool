import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/lib/mock-data";

const styles: Record<RiskLevel, string> = {
  Low: "bg-risk-low/20 text-risk-low border-risk-low/40",
  Medium: "bg-risk-medium/25 text-amber-700 border-risk-medium/50",
  High: "bg-risk-high/20 text-risk-high border-risk-high/40",
  Critical: "bg-risk-critical/20 text-risk-critical border-risk-critical/40",
  Obsolete: "bg-risk-obsolete/20 text-foreground border-risk-obsolete/40",
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge variant="outline" className={`font-medium ${styles[level]}`}>
      {level}
    </Badge>
  );
}
