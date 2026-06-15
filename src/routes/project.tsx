import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
import { RiskBadge } from "@/components/risk-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, FileText, GitCompare, FileDown, Lock, Eye,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/project")({
  component: ProjectOverview,
});

const costByCategory = [
  { name: "ICs", customer: 64200, internal: 42800 },
  { name: "Passives", customer: 12400, internal: 7100 },
  { name: "Connectors", customer: 18600, internal: 13900 },
  { name: "Electro-Mechanical", customer: 21300, internal: 14200 },
  { name: "Others", customer: 8300, internal: 4300 },
];

const supplierStrategy = [
  { name: "China Buyer", value: 38200, color: "var(--brand)" },
  { name: "LCSC", value: 12400, color: "#22c55e" },
  { name: "Official Rep", value: 18800, color: "#f59e0b" },
  { name: "Digi-Key", value: 9200, color: "#3b82f6" },
  { name: "Existing Stock", value: 3700, color: "#64748b" },
];
const supplierTotal = supplierStrategy.reduce((a, b) => a + b.value, 0);

const riskSummary = [
  { name: "Low", value: 142, color: "var(--risk-low)" },
  { name: "Medium", value: 28, color: "var(--risk-medium)" },
  { name: "High", value: 9, color: "var(--risk-high)" },
  { name: "Critical", value: 5, color: "var(--risk-critical)" },
  { name: "Obsolete", value: 2, color: "var(--risk-obsolete)" },
];

const topSavings = [
  { mpn: "STM32F407VGT6", mfr: "STMicroelectronics", cust: 8.42, intCost: 5.78, source: "China Buyer", risk: "Low" as const },
  { mpn: "ADXL345BCCZ", mfr: "Analog Devices", cust: 4.85, intCost: 3.12, source: "China Buyer", risk: "Low" as const },
  { mpn: "MAX232CPE", mfr: "Maxim Integrated", cust: 1.95, intCost: 0.78, source: "China Buyer", risk: "High" as const },
  { mpn: "TPS54331DR", mfr: "Texas Instruments", cust: 2.18, intCost: 1.45, source: "Official Rep", risk: "Medium" as const },
  { mpn: "PIC16F877A", mfr: "Microchip", cust: 5.60, intCost: 3.85, source: "Official Rep", risk: "Medium" as const },
  { mpn: "LM358N", mfr: "Texas Instruments", cust: 0.42, intCost: 0.18, source: "China Buyer", risk: "Low" as const },
];

const topRisks = [
  { mpn: "AD7920ARTZ-REEL7", mfr: "Analog Devices", risk: "Critical" as const, reason: "Out of stock globally", stock: 0, lead: "40w", action: "Find alternative urgently" },
  { mpn: "LT1086CT-5", mfr: "Analog Devices", risk: "Obsolete" as const, reason: "EOL announced", stock: 850, lead: "18w", action: "Last-time buy / redesign" },
  { mpn: "XC7A35T-1FTG256C", mfr: "Xilinx / AMD", risk: "High" as const, reason: "Allocation, long lead", stock: 48, lead: "52w", action: "Lock Official Rep quote" },
  { mpn: "MAX232CPE", mfr: "Maxim Integrated", risk: "High" as const, reason: "NRND lifecycle", stock: 2400, lead: "16w", action: "Propose MAX3232 alt" },
  { mpn: "TPS54331DR", mfr: "Texas Instruments", risk: "Medium" as const, reason: "Long lead time", stock: 320, lead: "26w", action: "Buffer stock 6 months" },
];

function ProjectOverview() {
  return (
    <AppLayout>
      <PageHeader
        title="סקירת פרויקט"
        subtitle="Elbit Systems · Radar Control Board v3 · ELB-RCB-003"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline"><Upload className="h-4 w-4 ml-1" />טעינת BOM חדש</Button>
            <Button size="sm" variant="outline"><FileSpreadsheet className="h-4 w-4 ml-1" />טעינת מחירון סין</Button>
            <Button size="sm" variant="outline"><FileText className="h-4 w-4 ml-1" />העלאת הצעת נציג רשמי</Button>
            <Button size="sm" variant="outline"><GitCompare className="h-4 w-4 ml-1" />השוואת גרסאות</Button>
            <Button size="sm" variant="outline"><FileDown className="h-4 w-4 ml-1" />ייצוא דוח לקוח</Button>
            <Button size="sm"><FileDown className="h-4 w-4 ml-1" />ייצוא דוח פנימי</Button>
          </div>
        }
      />

      {/* Project header card */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-1" style={{ background: "var(--gradient-brand)" }} />
        <CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
          <Info label="Customer" value="Elbit Systems" />
          <Info label="Project Name" value="Radar Control Board v3" />
          <Info label="Project Code" value="ELB-RCB-003" />
          <Info label="Active BOM Version" value={<span className="font-mono">v4.2</span>} />
          <Info label="Pricing Snapshot" value="With China Quote" />
          <Info label="Status" value={<Badge variant="outline" className="bg-risk-medium/30 text-amber-700 border-risk-medium/50">In Review</Badge>} />
          <Info label="Last Updated" value="15/06/2026" />
          <Info label="Build Quantity" value="1,000 assemblies" />
        </CardContent>
      </Card>

      {/* KPI sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Customer-facing */}
        <Card className="border-emerald-200/60 bg-emerald-50/40">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider text-emerald-700 flex items-center gap-2">
              <Eye className="h-3.5 w-3.5" /> Customer-Facing
            </CardTitle>
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-100/60 text-[10px]">CUSTOMER SAFE</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground mb-1">Customer BOM Value</div>
            <div className="text-3xl font-bold text-emerald-700">$124,800</div>
            <div className="text-[11px] text-muted-foreground mt-1">Quoted price · 1,000 assemblies</div>
          </CardContent>
        </Card>

        {/* Internal */}
        <Card className="lg:col-span-2 border-amber-300/60 bg-amber-50/30">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider text-amber-800 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" /> GlinTech Internal
            </CardTitle>
            <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-100/70 text-[10px]">INTERNAL ONLY · DO NOT SHARE</Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Internal Procurement Cost</div>
              <div className="text-2xl font-bold">$82,300</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Gross Delta</div>
              <div className="text-2xl font-bold text-risk-low">+$42,500</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Gross Margin</div>
              <div className="text-2xl font-bold text-risk-low">34.1%</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operational KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Kpi label="Critical Parts" value="7" tone="bad" hint="Block production" />
        <Kpi label="Missing Stock" value="9" tone="warn" hint="Below required qty" />
        <Kpi label="EOL / Obsolete" value="2" tone="warn" hint="Lifecycle risk" />
        <Kpi label="Needs Review" value="14" tone="warn" hint="Manual check" />
        <Kpi label="BOM Quality Score" value="87 / 100" tone="good" hint="Identification level" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm">Customer Price vs Internal Cost — by Category</CardTitle>
            <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-100/70 text-[10px]">INTERNAL</Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={costByCategory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="customer" fill="var(--brand)" name="Customer Price" radius={[4, 4, 0, 0]} />
                <Bar dataKey="internal" fill="#10b981" name="Internal Cost" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {riskSummary.map((r) => {
              const total = riskSummary.reduce((a, b) => a + b.value, 0);
              const pct = (r.value / total) * 100;
              return (
                <div key={r.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{r.name}</span>
                    <span className="tabular-nums text-muted-foreground">{r.value} parts</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${pct}%`, background: r.color }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Supplier strategy + BOM version */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Supplier Strategy — Spend Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {supplierStrategy.map((s) => {
              const pct = (s.value / supplierTotal) * 100;
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                      <span className="font-medium">{s.name}</span>
                    </div>
                    <span className="tabular-nums text-muted-foreground">${s.value.toLocaleString()} · {pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">BOM Version / Pricing Snapshot</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-3">
            <RowItem label="Active BOM Version" value={<span className="font-mono font-semibold">v4.2</span>} />
            <RowItem label="Current Pricing Snapshot" value="With China Quote" />
            <RowItem label="China Quote loaded" value={<span className="inline-flex items-center gap-1 text-risk-low font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>} />
            <RowItem label="Official Rep Quote loaded" value={<span className="inline-flex items-center gap-1 text-risk-low font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>} />
            <RowItem label="Last export" value={<span className="text-xs">Customer PDF · 14/06/2026</span>} />
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-risk-low" /> Top Savings Opportunities</CardTitle>
            <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-100/70 text-[10px]">INTERNAL</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">MPN</TableHead>
                  <TableHead className="text-right">Manufacturer</TableHead>
                  <TableHead className="text-right tabular-nums">Cust. Unit</TableHead>
                  <TableHead className="text-right tabular-nums">Int. Unit</TableHead>
                  <TableHead className="text-right tabular-nums">Saving</TableHead>
                  <TableHead className="text-right">Internal Source</TableHead>
                  <TableHead className="text-right">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSavings.map((r) => {
                  const save = r.cust - r.intCost;
                  const pct = (save / r.cust) * 100;
                  return (
                    <TableRow key={r.mpn}>
                      <TableCell className="font-mono text-xs">{r.mpn}</TableCell>
                      <TableCell className="text-xs">{r.mfr}</TableCell>
                      <TableCell className="text-right tabular-nums">${r.cust.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">${r.intCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-risk-low font-semibold">
                        ${save.toFixed(2)} <span className="text-[10px] text-muted-foreground">({pct.toFixed(0)}%)</span>
                      </TableCell>
                      <TableCell className="text-xs">{r.source}</TableCell>
                      <TableCell><RiskBadge level={r.risk} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-risk-critical" /> Top Risk Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">MPN</TableHead>
                  <TableHead className="text-right">Manufacturer</TableHead>
                  <TableHead className="text-right">Risk Level</TableHead>
                  <TableHead className="text-right">Risk Reason</TableHead>
                  <TableHead className="text-right tabular-nums">Stock</TableHead>
                  <TableHead className="text-right">Lead Time</TableHead>
                  <TableHead className="text-right">Recommended Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topRisks.map((r) => (
                  <TableRow key={r.mpn}>
                    <TableCell className="font-mono text-xs">{r.mpn}</TableCell>
                    <TableCell className="text-xs">{r.mfr}</TableCell>
                    <TableCell><RiskBadge level={r.risk} /></TableCell>
                    <TableCell className="text-xs">{r.reason}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{r.stock.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs">{r.lead}</TableCell>
                    <TableCell className="text-xs">{r.action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="font-semibold mt-1 text-sm">{value}</div>
    </div>
  );
}

function RowItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
