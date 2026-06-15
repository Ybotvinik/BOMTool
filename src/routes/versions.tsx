import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, GitCompare, Plus, Archive, FileDown, Upload, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/versions")({
  component: Versions,
});

type VStatus =
  | "Draft"
  | "Compared"
  | "Priced"
  | "Reviewed"
  | "Customer Exported"
  | "Approved"
  | "Superseded"
  | "Archived";

const statusTone: Record<VStatus, string> = {
  Draft: "bg-muted text-muted-foreground border-border",
  Compared: "bg-brand/10 text-brand border-brand/30",
  Priced: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Reviewed: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  "Customer Exported": "bg-purple-500/15 text-purple-700 border-purple-500/30",
  Approved: "bg-risk-low/15 text-risk-low border-risk-low/30",
  Superseded: "bg-muted text-muted-foreground border-border",
  Archived: "bg-muted/60 text-muted-foreground border-border line-through",
};

const versions: Array<{
  version: string;
  type: string;
  date: string;
  by: string;
  file: string;
  status: VStatus;
  comparedTo: string;
  changes: string;
  snapshots: number;
  customerExported: boolean;
  internalReport: boolean;
  active: boolean;
}> = [
  {
    version: "v4.3",
    type: "PCB / SMT",
    date: "2026-06-12 14:22",
    by: "Yossi Cohen",
    file: "ELB-RCB-003_BOM_v4.3.xlsx",
    status: "Reviewed",
    comparedTo: "v4.2",
    changes: "+12 / -4 / Δ29",
    snapshots: 3,
    customerExported: false,
    internalReport: true,
    active: true,
  },
  {
    version: "v4.2",
    type: "PCB / SMT",
    date: "2026-05-28 09:10",
    by: "Maya Levi",
    file: "ELB-RCB-003_BOM_v4.2.xlsx",
    status: "Superseded",
    comparedTo: "v4.1",
    changes: "+8 / -2 / Δ17",
    snapshots: 2,
    customerExported: true,
    internalReport: true,
    active: false,
  },
  {
    version: "v4.1",
    type: "PCB / SMT",
    date: "2026-05-04 16:45",
    by: "Maya Levi",
    file: "ELB-RCB-003_BOM_v4.1.xlsx",
    status: "Approved",
    comparedTo: "v4.0",
    changes: "+3 / -1 / Δ9",
    snapshots: 2,
    customerExported: true,
    internalReport: true,
    active: false,
  },
  {
    version: "v4.0",
    type: "PCB / SMT",
    date: "2026-04-19 11:02",
    by: "Yossi Cohen",
    file: "ELB-RCB-003_BOM_v4.0.xlsx",
    status: "Archived",
    comparedTo: "v3.5",
    changes: "Major rev",
    snapshots: 1,
    customerExported: true,
    internalReport: true,
    active: false,
  },
  {
    version: "v3.5",
    type: "PCB / SMT",
    date: "2026-03-02 08:30",
    by: "Eitan Bar",
    file: "ELB-RCB-003_BOM_v3.5.xlsx",
    status: "Archived",
    comparedTo: "—",
    changes: "Initial",
    snapshots: 0,
    customerExported: false,
    internalReport: false,
    active: false,
  },
];

type Snapshot = {
  name: string;
  bomVersion: string;
  date: string;
  mode: "Online Only" | "With China Quote" | "With Official Rep Quote" | "Manual Override";
  china: boolean;
  rep: boolean;
  customerValue: string;
  internalCost: string;
  delta: string;
  margin: string;
  status: "Draft" | "Active" | "Archived";
};

const snapshots: Snapshot[] = [
  {
    name: "With China Quote",
    bomVersion: "v4.3",
    date: "2026-06-13 10:14",
    mode: "With China Quote",
    china: true,
    rep: false,
    customerValue: "$124,800",
    internalCost: "$82,300",
    delta: "+$42,500",
    margin: "34.1%",
    status: "Active",
  },
  {
    name: "Baseline Online",
    bomVersion: "v4.3",
    date: "2026-06-12 17:02",
    mode: "Online Only",
    china: false,
    rep: false,
    customerValue: "$124,800",
    internalCost: "$118,200",
    delta: "+$6,600",
    margin: "5.3%",
    status: "Draft",
  },
  {
    name: "Rep Quote — Avnet",
    bomVersion: "v4.3",
    date: "2026-06-12 15:48",
    mode: "With Official Rep Quote",
    china: false,
    rep: true,
    customerValue: "$124,800",
    internalCost: "$101,400",
    delta: "+$23,400",
    margin: "18.7%",
    status: "Draft",
  },
  {
    name: "v4.2 Final Pricing",
    bomVersion: "v4.2",
    date: "2026-05-29 12:00",
    mode: "With China Quote",
    china: true,
    rep: false,
    customerValue: "$118,400",
    internalCost: "$77,700",
    delta: "+$40,700",
    margin: "34.4%",
    status: "Archived",
  },
  {
    name: "v4.2 Online Baseline",
    bomVersion: "v4.2",
    date: "2026-05-28 14:20",
    mode: "Online Only",
    china: false,
    rep: false,
    customerValue: "$118,400",
    internalCost: "$112,900",
    delta: "+$5,500",
    margin: "4.6%",
    status: "Archived",
  },
  {
    name: "v4.1 Manual Override",
    bomVersion: "v4.1",
    date: "2026-05-06 09:11",
    mode: "Manual Override",
    china: true,
    rep: true,
    customerValue: "$115,200",
    internalCost: "$79,500",
    delta: "+$35,700",
    margin: "30.9%",
    status: "Archived",
  },
  {
    name: "v4.1 Online",
    bomVersion: "v4.1",
    date: "2026-05-05 08:00",
    mode: "Online Only",
    china: false,
    rep: false,
    customerValue: "$115,200",
    internalCost: "$110,100",
    delta: "+$5,100",
    margin: "4.4%",
    status: "Archived",
  },
  {
    name: "v4.0 Final",
    bomVersion: "v4.0",
    date: "2026-04-20 13:30",
    mode: "With China Quote",
    china: true,
    rep: false,
    customerValue: "$109,800",
    internalCost: "$71,200",
    delta: "+$38,600",
    margin: "35.2%",
    status: "Archived",
  },
];

const modeTone: Record<Snapshot["mode"], string> = {
  "Online Only": "bg-muted text-muted-foreground border-border",
  "With China Quote": "bg-risk-low/15 text-risk-low border-risk-low/30",
  "With Official Rep Quote": "bg-brand/10 text-brand border-brand/30",
  "Manual Override": "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

function ContextBar() {
  const items = [
    ["Customer", "Elbit Systems"],
    ["Project", "Radar Control Board v3"],
    ["Project Code", "ELB-RCB-003"],
    ["Active BOM", "v4.3"],
    ["Pricing Snapshot", "With China Quote"],
    ["BOM Type", "PCB / SMT Assembly"],
    ["Build Qty", "1,000"],
    ["Status", "In Review"],
  ];
  return (
    <Card className="mb-3 py-0">
      <CardContent className="p-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
        {items.map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{k}:</span>
            <span className="font-semibold tracking-tight">{v}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Versions() {
  const [overwriteTarget, setOverwriteTarget] = useState<string | null>(null);

  return (
    <AppLayout>
      <PageHeader
        title="ניהול גרסאות"
        subtitle="ניהול ידני של גרסאות BOM, גרסאות תמחור, קבצי מקור ודוחות שהופקו."
        actions={
          <>
            <Button size="sm" variant="outline">
              <FileDown className="h-3.5 w-3.5 ml-1" /> ייצוא היסטוריה
            </Button>
            <Button size="sm" asChild>
              <Link to="/upload-bom">
                <Plus className="h-3.5 w-3.5 ml-1" /> צור גרסה חדשה
              </Link>
            </Button>
          </>
        }
      />

      <ContextBar />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        <Kpi label="Total BOM Versions" value="5" />
        <Kpi label="Active Version" value="v4.3" tone="good" />
        <Kpi label="Pricing Snapshots" value="8" />
        <Kpi label="Customer Exports" value="4" />
        <Kpi label="Internal Reports" value="6" />
        <Kpi label="Archived Versions" value="2" tone="warn" />
      </div>

      <Card className="mb-3 overflow-hidden py-0">
        <CardHeader className="py-2 px-3 border-b bg-muted/40">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <GitCompare className="h-3.5 w-3.5" /> BOM Versions
          </CardTitle>
        </CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {[
                  "Version",
                  "BOM Type",
                  "Uploaded",
                  "By",
                  "Source File",
                  "Status",
                  "Compared To",
                  "Change Summary",
                  "Snapshots",
                  "Cust. Exp.",
                  "Int. Rep.",
                  "Active",
                  "Actions",
                ].map((h) => (
                  <TableHead key={h} className="h-8 text-[11px] whitespace-nowrap">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.version} className="text-[12px]">
                  <TableCell className="font-semibold">{v.version}</TableCell>
                  <TableCell className="text-muted-foreground">{v.type}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{v.date}</TableCell>
                  <TableCell>{v.by}</TableCell>
                  <TableCell className="font-mono text-[11px]">{v.file}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusTone[v.status]}>
                      {v.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{v.comparedTo}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{v.changes}</TableCell>
                  <TableCell className="text-center tabular-nums">{v.snapshots}</TableCell>
                  <TableCell className="text-center">
                    {v.customerExported ? <CheckCircle2 className="h-3.5 w-3.5 text-risk-low inline" /> : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {v.internalReport ? <CheckCircle2 className="h-3.5 w-3.5 text-brand inline" /> : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {v.active ? <Badge className="bg-risk-low/15 text-risk-low border-risk-low/30">Active</Badge> : ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">View</Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" asChild>
                        <Link to="/changes">Compare</Link>
                      </Button>
                      {!v.active && v.status !== "Archived" && (
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">Set Active</Button>
                      )}
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">Snapshot</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px] text-amber-700 border-amber-500/40"
                        onClick={() => setOverwriteTarget(v.version)}
                      >
                        <Upload className="h-3 w-3 ml-1" /> Overwrite
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">
                        <Archive className="h-3 w-3 ml-1" /> Archive
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">Source</Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">Export</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="py-2 px-3 border-b bg-muted/40 flex-row items-center justify-between">
          <CardTitle className="text-xs font-semibold">Pricing Snapshots</CardTitle>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">
            <Plus className="h-3 w-3 ml-1" /> Create Snapshot
          </Button>
        </CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {[
                  "Snapshot Name",
                  "BOM Version",
                  "Created",
                  "Pricing Mode",
                  "China",
                  "Rep",
                  "Customer BOM Value",
                  "Internal Cost",
                  "Gross Δ",
                  "Gross Margin",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <TableHead key={h} className="h-8 text-[11px] whitespace-nowrap">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((s) => (
                <TableRow key={s.name} className="text-[12px]">
                  <TableCell className="font-semibold">{s.name}</TableCell>
                  <TableCell>{s.bomVersion}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{s.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={modeTone[s.mode]}>
                      {s.mode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{s.china ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{s.rep ? "✓" : "—"}</TableCell>
                  <TableCell className="tabular-nums">{s.customerValue}</TableCell>
                  <TableCell className="tabular-nums">{s.internalCost}</TableCell>
                  <TableCell className="tabular-nums text-risk-low font-semibold">{s.delta}</TableCell>
                  <TableCell className="tabular-nums font-semibold">{s.margin}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        s.status === "Active"
                          ? "bg-risk-low/15 text-risk-low border-risk-low/30"
                          : s.status === "Draft"
                          ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">Open</Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">Set Active</Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">Export</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3" />
        דריסת גרסה תעביר את הגרסה הקודמת לארכיון אוטומטית ותירשם בהיסטוריית הפעולות.
      </p>

      <Dialog open={!!overwriteTarget} onOpenChange={(o) => !o && setOverwriteTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" /> דריסת גרסה {overwriteTarget}
            </DialogTitle>
            <DialogDescription className="text-[12px] leading-relaxed pt-1">
              דריסת גרסה תשמור את הגרסה הקודמת בארכיון אך תחליף את הגרסה הפעילה. פעולה זו תירשם
              בהיסטוריית הפעולות ולא ניתן לבטל אותה ישירות.
            </DialogDescription>
          </DialogHeader>
          <div className="text-[12px] bg-muted/40 border rounded-md p-2 space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">גרסה נוכחית</span><span className="font-semibold">{overwriteTarget}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">פעולה</span><span>Archive → Overwrite</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">תיעוד</span><span>נרשם ב-Activity Log</span></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setOverwriteTarget(null)}>Cancel</Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-600/90" onClick={() => setOverwriteTarget(null)}>
              <Archive className="h-3.5 w-3.5 ml-1" /> Archive and Overwrite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
