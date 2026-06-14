import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { projects } from "@/lib/mock-data";
import { Plus, Upload, FolderOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  component: ProjectsPage,
});

const statusVariant: Record<string, string> = {
  Active: "bg-risk-low/20 text-risk-low border-risk-low/40",
  "In Review": "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
  Quoting: "bg-brand/15 text-brand border-brand/40",
  Archived: "bg-muted text-muted-foreground",
};

const fmt = (n: number) => `$${n.toLocaleString()}`;

function ProjectsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="פרויקטים"
        subtitle="ניהול פרויקטי לקוח, גרסאות BOM ועלויות רכש"
        actions={
          <>
            <Button variant="outline"><FolderOpen className="h-4 w-4 ml-1" /> פתיחת תיקיית Drive</Button>
            <Button variant="outline"><Upload className="h-4 w-4 ml-1" /> טעינת BOM</Button>
            <Button style={{ background: "var(--gradient-brand)" }} className="text-white">
              <Plus className="h-4 w-4 ml-1" /> פרויקט חדש
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">Customer</TableHead>
              <TableHead className="text-right">Project Name</TableHead>
              <TableHead>Project Code</TableHead>
              <TableHead>Active BOM Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-left">Customer BOM Value</TableHead>
              <TableHead className="text-left">Internal Cost</TableHead>
              <TableHead className="text-left">Gross Delta</TableHead>
              <TableHead>Critical Parts</TableHead>
              <TableHead>Needs Review</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell className="font-medium">{p.customer}</TableCell>
                <TableCell>
                  <Link to="/project" className="text-brand hover:underline">{p.name}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.code}</TableCell>
                <TableCell>{p.activeVersion}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusVariant[p.status]}>{p.status}</Badge>
                </TableCell>
                <TableCell className="text-left tabular-nums">{fmt(p.customerValue)}</TableCell>
                <TableCell className="text-left tabular-nums">{fmt(p.internalCost)}</TableCell>
                <TableCell className="text-left tabular-nums text-risk-low font-medium">+{fmt(p.grossDelta)}</TableCell>
                <TableCell className="text-center">
                  {p.critical > 0 ? <Badge variant="outline" className="bg-risk-critical/15 text-risk-critical border-risk-critical/40">{p.critical}</Badge> : "—"}
                </TableCell>
                <TableCell className="text-center">{p.needsReview}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.lastUpdated}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
