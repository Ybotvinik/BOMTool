import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GitCompare, FileDown, Plus, Upload, Filter } from "lucide-react";

export const Route = createFileRoute("/changes")({
  component: Changes,
});

type ChangeType =
  | "Added"
  | "Removed"
  | "Qty Changed"
  | "MPN Changed"
  | "Manufacturer Changed"
  | "Description Changed"
  | "DNP Changed"
  | "Unchanged";

type Impact = "Low" | "Medium" | "High" | "Critical";

const typeTone: Record<ChangeType, string> = {
  Added: "bg-risk-low/15 text-risk-low border-risk-low/30",
  Removed: "bg-risk-critical/15 text-risk-critical border-risk-critical/30",
  "Qty Changed": "bg-amber-500/15 text-amber-700 border-amber-500/30",
  "MPN Changed": "bg-brand/15 text-brand border-brand/30",
  "Manufacturer Changed": "bg-purple-500/15 text-purple-700 border-purple-500/30",
  "Description Changed": "bg-muted text-foreground border-border",
  "DNP Changed": "bg-blue-500/15 text-blue-700 border-blue-500/30",
  Unchanged: "bg-muted text-muted-foreground border-border",
};

const impactTone: Record<Impact, string> = {
  Low: "bg-risk-low/15 text-risk-low border-risk-low/30",
  Medium: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  High: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  Critical: "bg-risk-critical/15 text-risk-critical border-risk-critical/30",
};

type Row = {
  type: ChangeType;
  line: string;
  prevMpn: string;
  newMpn: string;
  mfr: string;
  prevQty: number | string;
  newQty: number | string;
  prevDesc: string;
  newDesc: string;
  impact: Impact;
  cost: string;
  risk: string;
  action: string;
  needsReview: boolean;
};

const rows: Row[] = [
  {
    type: "Added",
    line: "U17",
    prevMpn: "—",
    newMpn: "TPS62933PDRLR",
    mfr: "Texas Instruments",
    prevQty: "—",
    newQty: 2,
    prevDesc: "—",
    newDesc: "Buck Converter 3A 2.4V-5.5V",
    impact: "High",
    cost: "+$2.84",
    risk: "Single Source",
    action: "Reprice Line",
    needsReview: true,
  },
  {
    type: "Added",
    line: "C58",
    prevMpn: "—",
    newMpn: "GRM188R71C104KA01D",
    mfr: "Murata",
    prevQty: "—",
    newQty: 8,
    prevDesc: "—",
    newDesc: "0.1uF 16V X7R 0603",
    impact: "Low",
    cost: "+$0.24",
    risk: "Low",
    action: "Approve Change",
    needsReview: false,
  },
  {
    type: "Removed",
    line: "R44",
    prevMpn: "CRCW06034K70FKEA",
    newMpn: "—",
    mfr: "Vishay",
    prevQty: 4,
    newQty: "—",
    prevDesc: "4.7K 1% 0603",
    newDesc: "—",
    impact: "Low",
    cost: "−$0.08",
    risk: "Reduced",
    action: "Remove from Pricing",
    needsReview: false,
  },
  {
    type: "MPN Changed",
    line: "U03",
    prevMpn: "STM32F407VGT6",
    newMpn: "STM32F407VGT7",
    mfr: "STMicroelectronics",
    prevQty: 1,
    newQty: 1,
    prevDesc: "MCU 32-bit ARM Cortex-M4",
    newDesc: "MCU 32-bit ARM Cortex-M4 (industrial)",
    impact: "Critical",
    cost: "+$1.20",
    risk: "Lifecycle",
    action: "Engineering Review",
    needsReview: true,
  },
  {
    type: "Qty Changed",
    line: "C12",
    prevMpn: "C0805C104K5RACTU",
    newMpn: "C0805C104K5RACTU",
    mfr: "KEMET",
    prevQty: 12,
    newQty: 16,
    prevDesc: "0.1uF 50V X7R 0805",
    newDesc: "0.1uF 50V X7R 0805",
    impact: "Medium",
    cost: "+$0.32",
    risk: "Low",
    action: "Reprice Line",
    needsReview: false,
  },
  {
    type: "Manufacturer Changed",
    line: "L05",
    prevMpn: "SRR1260-100M",
    newMpn: "SRR1260-100M",
    mfr: "Bourns → Coilcraft",
    prevQty: 2,
    newQty: 2,
    prevDesc: "10uH Shielded Power Inductor",
    newDesc: "10uH Shielded Power Inductor",
    impact: "High",
    cost: "+$0.46",
    risk: "Alt Source",
    action: "Engineering Review",
    needsReview: true,
  },
  {
    type: "Description Changed",
    line: "R12",
    prevMpn: "RC0603FR-0710KL",
    newMpn: "RC0603FR-0710KL",
    mfr: "Yageo",
    prevQty: 6,
    newQty: 6,
    prevDesc: "RES 10K 0603",
    newDesc: "RES SMD 10K OHM 1% 1/10W 0603",
    impact: "Low",
    cost: "$0.00",
    risk: "—",
    action: "Keep Normalized Description",
    needsReview: false,
  },
  {
    type: "DNP Changed",
    line: "J09",
    prevMpn: "61300411121",
    newMpn: "61300411121",
    mfr: "Würth",
    prevQty: 1,
    newQty: 1,
    prevDesc: "Header 4-pin (Populated)",
    newDesc: "Header 4-pin (DNP — debug only)",
    impact: "Medium",
    cost: "−$0.62",
    risk: "Assembly",
    action: "Mark as DNP",
    needsReview: true,
  },
  {
    type: "MPN Changed",
    line: "U11",
    prevMpn: "LM358DR",
    newMpn: "LM358AYDR",
    mfr: "Texas Instruments",
    prevQty: 2,
    newQty: 2,
    prevDesc: "Dual Op-Amp SOIC-8",
    newDesc: "Dual Op-Amp Automotive SOIC-8",
    impact: "High",
    cost: "+$0.78",
    risk: "Lifecycle",
    action: "Customer Clarification",
    needsReview: true,
  },
  {
    type: "Qty Changed",
    line: "R28",
    prevMpn: "ERJ-3EKF1002V",
    newMpn: "ERJ-3EKF1002V",
    mfr: "Panasonic",
    prevQty: 10,
    newQty: 8,
    prevDesc: "10K 1% 0603",
    newDesc: "10K 1% 0603",
    impact: "Low",
    cost: "−$0.12",
    risk: "Low",
    action: "Reprice Line",
    needsReview: false,
  },
  {
    type: "Added",
    line: "TP14",
    prevMpn: "—",
    newMpn: "5015",
    mfr: "Keystone",
    prevQty: "—",
    newQty: 4,
    prevDesc: "—",
    newDesc: "Test Point Multi-Purpose",
    impact: "Low",
    cost: "+$0.18",
    risk: "Low",
    action: "Approve Change",
    needsReview: false,
  },
  {
    type: "Removed",
    line: "D07",
    prevMpn: "1N4148WTP",
    newMpn: "—",
    mfr: "Micro Commercial",
    prevQty: 2,
    newQty: "—",
    prevDesc: "Switching Diode 100V",
    newDesc: "—",
    impact: "Medium",
    cost: "−$0.14",
    risk: "Reduced",
    action: "Remove from Pricing",
    needsReview: false,
  },
];

const actionOptions = [
  "Reprice Line",
  "Engineering Review",
  "Customer Clarification",
  "Keep Normalized Description",
  "Remove from Pricing",
  "Mark as DNP",
  "Approve Change",
];

function Changes() {
  const [from, setFrom] = useState("v4.2");
  const [to, setTo] = useState("v4.3");
  const [bomType, setBomType] = useState("PCB / SMT Assembly BOM");
  const [fType, setFType] = useState<string>("all");
  const [fImpact, setFImpact] = useState<string>("all");
  const [fReview, setFReview] = useState<string>("all");
  const [fCost, setFCost] = useState<string>("all");
  const [fRisk, setFRisk] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fType !== "all" && r.type !== fType) return false;
        if (fImpact !== "all" && r.impact !== fImpact) return false;
        if (fReview === "yes" && !r.needsReview) return false;
        if (fReview === "no" && r.needsReview) return false;
        if (fCost === "increase" && !r.cost.startsWith("+")) return false;
        if (fCost === "decrease" && !r.cost.startsWith("−")) return false;
        if (fRisk !== "all" && !r.risk.toLowerCase().includes(fRisk.toLowerCase())) return false;
        if (
          search &&
          !(`${r.prevMpn} ${r.newMpn}`.toLowerCase().includes(search.toLowerCase()))
        )
          return false;
        return true;
      }),
    [fType, fImpact, fReview, fCost, fRisk, search]
  );

  return (
    <AppLayout>
      <PageHeader
        title="השוואת שינויים"
        subtitle="השוואת BOM חדש מול גרסה קיימת לפני תמחור מחדש."
        actions={
          <>
            <Button size="sm" variant="outline">
              <FileDown className="h-3.5 w-3.5 ml-1" /> ייצוא דוח השוואה
            </Button>
            <Button size="sm" variant="outline">
              <Upload className="h-3.5 w-3.5 ml-1" /> דרוס גרסה קיימת
            </Button>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 ml-1" /> צור גרסה חדשה
            </Button>
          </>
        }
      />

      {/* Comparison selector */}
      <Card className="mb-3 py-0">
        <CardContent className="p-2 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-brand" />
            <span className="text-[11px] font-semibold text-muted-foreground">השוואה:</span>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">Compare From</div>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="h-7 w-28 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["v4.2", "v4.1", "v4.0", "v3.5"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-muted-foreground pb-1.5">→</div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">Compare To</div>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="h-7 w-28 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["v4.3", "v4.2", "v4.1", "v4.0"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">BOM Type</div>
            <Select value={bomType} onValueChange={setBomType}>
              <SelectTrigger className="h-7 w-56 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PCB / SMT Assembly BOM">PCB / SMT Assembly BOM</SelectItem>
                <SelectItem value="Product / Mechanical BOM">Product / Mechanical BOM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ms-auto flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-[11px]">תמחר רק שורות שהשתנו</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]">תמחר את כל ה-BOM מחדש</Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-2">
        <Kpi label="Added Lines" value="12" tone="good" />
        <Kpi label="Removed Lines" value="4" tone="bad" />
        <Kpi label="Qty Changed" value="9" />
        <Kpi label="MPN Changed" value="3" tone="warn" />
        <Kpi label="Manufacturer Changed" value="2" />
        <Kpi label="Description Changed" value="17" />
        <Kpi label="DNP Changed" value="5" />
        <Kpi label="Needs Review" value="14" tone="warn" />
      </div>

      {/* Impact Summary */}
      <Card className="mb-3 py-0">
        <CardHeader className="py-1.5 px-3 border-b bg-muted/40">
          <CardTitle className="text-xs font-semibold">Impact Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <Kpi label="Customer BOM Value Δ" value="+$6,400" tone="good" />
          <Kpi label="Internal Cost Δ" value="+$4,600" />
          <Kpi label="Gross Delta Change" value="+$1,800" tone="good" />
          <Kpi label="Critical Parts Δ" value="+2" tone="warn" />
          <Kpi label="Missing Stock Δ" value="+3" tone="warn" />
          <Kpi label="EOL / Obsolete Δ" value="0" />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-3 py-0">
        <CardContent className="p-2 flex flex-wrap items-end gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> סינון:
          </div>
          <Select value={fType} onValueChange={setFType}>
            <SelectTrigger className="h-7 w-40 text-[12px]"><SelectValue placeholder="Change Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Change Types</SelectItem>
              {Object.keys(typeTone).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fImpact} onValueChange={setFImpact}>
            <SelectTrigger className="h-7 w-32 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Impact</SelectItem>
              {(["Low", "Medium", "High", "Critical"] as Impact[]).map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fReview} onValueChange={setFReview}>
            <SelectTrigger className="h-7 w-36 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Needs Review (All)</SelectItem>
              <SelectItem value="yes">Needs Review</SelectItem>
              <SelectItem value="no">No Review Needed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fCost} onValueChange={setFCost}>
            <SelectTrigger className="h-7 w-36 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cost Impact (Any)</SelectItem>
              <SelectItem value="increase">Cost Increase</SelectItem>
              <SelectItem value="decrease">Cost Decrease</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fRisk} onValueChange={setFRisk}>
            <SelectTrigger className="h-7 w-36 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Risk Impact (Any)</SelectItem>
              <SelectItem value="Lifecycle">Lifecycle</SelectItem>
              <SelectItem value="Single Source">Single Source</SelectItem>
              <SelectItem value="Alt Source">Alt Source</SelectItem>
              <SelectItem value="Assembly">Assembly</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search MPN…"
            className="h-7 w-44 text-[12px]"
          />
          <div className="ms-auto text-[11px] text-muted-foreground">
            מציג <span className="font-semibold text-foreground">{filtered.length}</span> מתוך {rows.length}
          </div>
        </CardContent>
      </Card>

      {/* Change Table */}
      <Card className="overflow-hidden py-0">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {[
                  "Change Type",
                  "Line",
                  "Prev MPN",
                  "New MPN",
                  "Manufacturer",
                  "Prev Qty",
                  "New Qty",
                  "Prev Description",
                  "New Description",
                  "Impact",
                  "Cost Δ",
                  "Risk",
                  "Recommended Action",
                ].map((h) => (
                  <TableHead key={h} className="h-8 text-[11px] whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={i} className="text-[12px]">
                  <TableCell>
                    <Badge variant="outline" className={typeTone[r.type]}>{r.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] font-semibold">{r.line}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{r.prevMpn}</TableCell>
                  <TableCell className="font-mono text-[11px] font-medium">{r.newMpn}</TableCell>
                  <TableCell className="text-[11px]">{r.mfr}</TableCell>
                  <TableCell className="text-center tabular-nums text-muted-foreground">{r.prevQty}</TableCell>
                  <TableCell className="text-center tabular-nums font-semibold">{r.newQty}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground max-w-[180px] truncate" title={r.prevDesc}>{r.prevDesc}</TableCell>
                  <TableCell className="text-[11px] max-w-[200px] truncate" title={r.newDesc}>{r.newDesc}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={impactTone[r.impact]}>{r.impact}</Badge>
                  </TableCell>
                  <TableCell
                    className={`tabular-nums font-semibold ${
                      r.cost.startsWith("+") ? "text-risk-critical" : r.cost.startsWith("−") ? "text-risk-low" : ""
                    }`}
                  >
                    {r.cost}
                  </TableCell>
                  <TableCell className="text-[11px]">{r.risk}</TableCell>
                  <TableCell>
                    <Select defaultValue={r.action}>
                      <SelectTrigger className="h-6 w-44 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {actionOptions.map((a) => <SelectItem key={a} value={a} className="text-[12px]">{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Bottom actions */}
      <div className="mt-3 flex flex-wrap gap-2 justify-end">
        <Button size="sm" variant="outline">תמחר רק שורות שהשתנו</Button>
        <Button size="sm" variant="outline">תמחר את כל ה-BOM מחדש</Button>
        <Button size="sm" variant="outline">צור גרסה חדשה</Button>
        <Button size="sm" variant="outline" className="text-amber-700 border-amber-500/40">
          <Upload className="h-3.5 w-3.5 ml-1" /> דרוס גרסה קיימת
        </Button>
        <Button size="sm">
          <FileDown className="h-3.5 w-3.5 ml-1" /> ייצוא דוח השוואה
        </Button>
      </div>
    </AppLayout>
  );
}
