import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { changes } from "@/lib/mock-data";

export const Route = createFileRoute("/changes")({
  component: Changes,
});

const typeColor: Record<string, string> = {
  Added: "bg-risk-low/15 text-risk-low border-risk-low/30",
  Removed: "bg-risk-critical/15 text-risk-critical border-risk-critical/30",
  "Qty Changed": "bg-risk-medium/30 text-amber-700 border-risk-medium/40",
  "MPN Changed": "bg-brand/15 text-brand border-brand/30",
  "Description Changed": "bg-muted text-foreground",
};

function Changes() {
  return (
    <AppLayout>
      <PageHeader title="השוואת שינויים ב-BOM" subtitle="v4.2 ↔ v4.1" />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        <Kpi label="Added Lines" value="3" tone="good" />
        <Kpi label="Removed Lines" value="1" tone="bad" />
        <Kpi label="Qty Changed" value="4" />
        <Kpi label="MPN Changed" value="2" />
        <Kpi label="Manufacturer Changed" value="1" />
        <Kpi label="Description Changed" value="5" />
        <Kpi label="Needs Review" value="6" tone="warn" />
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Impact Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Customer BOM Value Δ" value="+$482" tone="good" />
          <Kpi label="Internal Cost Δ" value="+$310" />
          <Kpi label="Critical Parts Δ" value="+1" tone="warn" />
          <Kpi label="Approval Required Δ" value="+2" tone="warn" />
        </CardContent>
      </Card>

      <Card className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {["Change Type","Line","Old Value","New Value","Impact","Recommended Action"].map(h => <TableHead key={h}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.map((c, i) => (
              <TableRow key={i}>
                <TableCell><Badge variant="outline" className={typeColor[c.type]}>{c.type}</Badge></TableCell>
                <TableCell>{c.line}</TableCell>
                <TableCell className="text-muted-foreground">{c.old}</TableCell>
                <TableCell className="font-medium">{c.new}</TableCell>
                <TableCell className="tabular-nums">{c.impact}</TableCell>
                <TableCell>{c.action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
