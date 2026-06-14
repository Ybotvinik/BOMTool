import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { versions } from "@/lib/mock-data";

export const Route = createFileRoute("/versions")({
  component: Versions,
});

function Versions() {
  return (
    <AppLayout>
      <PageHeader title="ניהול גרסאות" subtitle="היסטוריית גרסאות BOM של הפרויקט" />
      <Card className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {["Version","Uploaded Date","Uploaded By","File Name","Status","Compared To","Change Summary","Active","Actions"].map(h => <TableHead key={h}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map(v => (
              <TableRow key={v.name}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell>{v.date}</TableCell>
                <TableCell>{v.by}</TableCell>
                <TableCell className="font-mono text-xs">{v.file}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={v.status === "Active" ? "bg-risk-low/15 text-risk-low border-risk-low/30" : "bg-muted text-muted-foreground"}>{v.status}</Badge>
                </TableCell>
                <TableCell>{v.comparedTo}</TableCell>
                <TableCell className="text-muted-foreground">{v.changes}</TableCell>
                <TableCell>{v.active ? "✓" : ""}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" variant="outline">View</Button>
                    <Button size="sm" variant="outline">Compare</Button>
                    {!v.active && <Button size="sm" variant="outline">Set Active</Button>}
                    <Button size="sm" variant="outline">Overwrite</Button>
                    <Button size="sm" variant="outline">Archive</Button>
                    <Button size="sm" variant="outline">Export</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground mt-3">דריסת גרסה תעביר את הגרסה הקודמת לארכיון אוטומטית.</p>
    </AppLayout>
  );
}
