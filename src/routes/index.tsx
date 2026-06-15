import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
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

const statusHe: Record<string, string> = {
  Active: "פעיל",
  "In Review": "בבדיקה",
  Quoting: "בתמחור",
  Archived: "בארכיון",
};

const fmt = (n: number) => `$${n.toLocaleString()}`;

function ProjectsPage() {
  const total = projects.length;
  const active = projects.filter((p) => p.status === "Active" || p.status === "Quoting").length;
  const inReview = projects.filter((p) => p.status === "In Review").length;
  const criticalTotal = projects.reduce((s, p) => s + p.critical, 0);

  return (
    <AppLayout>
      <PageHeader
        title="פרויקטים"
        subtitle="ניהול פרויקטי לקוח, גרסאות BOM ועלויות רכש"
        actions={
          <>
            <Button variant="outline"><FolderOpen className="h-4 w-4 ml-1" /> פתיחת תיקיית Drive</Button>
            <Button variant="outline"><Upload className="h-4 w-4 ml-1" /> טעינת BOM</Button>
            <Button style={{ background: "var(--gradient-brand)" }} className="text-white shadow-md">
              <Plus className="h-4 w-4 ml-1" /> פרויקט חדש
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Kpi label="סה״כ פרויקטים" value={total} />
        <Kpi label="פרויקטים פעילים" value={active} tone="good" />
        <Kpi label="BOMs בבדיקה" value={inReview} tone="warn" />
        <Kpi label="רכיבים קריטיים" value={criticalTotal} tone="bad" />
        <Kpi label="דוחות שהופקו החודש" value={18} hint="יוני 2026" />
      </div>

      <Card className="overflow-hidden">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">לקוח</TableHead>
              <TableHead className="text-right">שם פרויקט</TableHead>
              <TableHead className="text-right">קוד פרויקט</TableHead>
              <TableHead className="text-right">גרסת BOM פעילה</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">Customer BOM Value</TableHead>
              <TableHead className="text-right">Internal Cost</TableHead>
              <TableHead className="text-center">Critical Parts</TableHead>
              <TableHead className="text-center">Needs Review</TableHead>
              <TableHead className="text-right">עודכן לאחרונה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell className="font-medium">{p.customer}</TableCell>
                <TableCell>
                  <Link to="/project" className="text-brand hover:underline font-medium">{p.name}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{p.code}</TableCell>
                <TableCell className="tabular-nums">{p.activeVersion}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusVariant[p.status]}>{statusHe[p.status] ?? p.status}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{fmt(p.customerValue)}</TableCell>
                <TableCell className="tabular-nums">{fmt(p.internalCost)}</TableCell>
                <TableCell className="text-center">
                  {p.critical > 0 ? <Badge variant="outline" className="bg-risk-critical/15 text-risk-critical border-risk-critical/40">{p.critical}</Badge> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-center tabular-nums">{p.needsReview}</TableCell>
                <TableCell className="text-muted-foreground text-sm tabular-nums">{p.lastUpdated}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
