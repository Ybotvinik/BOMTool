import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bomLines } from "@/lib/mock-data";

export const Route = createFileRoute("/quality")({
  component: Quality,
});

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    "Exact Match": "bg-risk-low/15 text-risk-low border-risk-low/30",
    "Description Updated": "bg-brand/15 text-brand border-brand/30",
    "Partial MPN": "bg-risk-medium/30 text-amber-700 border-risk-medium/40",
    Conflict: "bg-risk-high/15 text-risk-high border-risk-high/30",
    Unidentified: "bg-risk-critical/15 text-risk-critical border-risk-critical/30",
    "Needs Review": "bg-risk-high/15 text-risk-high border-risk-high/30",
  };
  return <Badge variant="outline" className={map[s]}>{s}</Badge>;
};

function Quality() {
  return (
    <AppLayout>
      <PageHeader title="איכות BOM וזיהוי רכיבים" subtitle="ניתוח שלמות זיהוי MPN ותיאורים" />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <Kpi label="Total BOM Lines" value="186" />
        <Kpi label="Exact MPN Matches" value="142" tone="good" />
        <Kpi label="Updated Descriptions" value="38" />
        <Kpi label="Partial MPNs" value="6" tone="warn" />
        <Kpi label="Description Conflicts" value="3" tone="warn" />
        <Kpi label="Unidentified Parts" value="2" tone="bad" />
        <Kpi label="Needs Review" value="14" tone="warn" />
        <Kpi label="BOM Quality Score" value="87" tone="good" />
      </div>

      <Card className="overflow-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              {["Original MPN","Matched MPN","Original Description","Normalized Description","Description Source","Desc Updated","Confidence","Status","Review Reason"].map(h => <TableHead key={h}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bomLines.map((l) => {
              const status = l.confidence < 95 ? "Partial MPN" : l.descUpdated ? "Description Updated" : "Exact Match";
              return (
                <TableRow key={l.line}>
                  <TableCell className="font-mono">{l.originalMpn}</TableCell>
                  <TableCell className="font-mono font-medium">{l.matchedMpn}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{l.originalDesc}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{l.normalizedDesc}</TableCell>
                  <TableCell>Octopart</TableCell>
                  <TableCell>{l.descUpdated ? "Yes" : "—"}</TableCell>
                  <TableCell>{l.confidence}%</TableCell>
                  <TableCell>{statusBadge(status)}</TableCell>
                  <TableCell className="text-muted-foreground">{l.needsReview ? l.notes || "Manual confirm" : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
