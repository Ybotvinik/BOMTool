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
  { name: "Electro-Mech.", customer: 21300, internal: 14200 },
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
const riskTotal = riskSummary.reduce((a, b) => a + b.value, 0);

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
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"><Upload className="h-3.5 w-3.5 ml-1" />טעינת BOM חדש</Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"><FileSpreadsheet className="h-3.5 w-3.5 ml-1" />טעינת מחירון סין</Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"><FileText className="h-3.5 w-3.5 ml-1" />הצעת נציג רשמי</Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"><GitCompare className="h-3.5 w-3.5 ml-1" />השוואת גרסאות</Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"><FileDown className="h-3.5 w-3.5 ml-1" />ייצוא דוח לקוח</Button>
            <Button size="sm" className="h-7 px-2 text-xs"><FileDown className="h-3.5 w-3.5 ml-1" />ייצוא דוח פנימי</Button>
          </div>
        }
      />

      {/* Row 1: compact info bar */}
      <Card className="mb-3 py-0 overflow-hidden">
        <div className="h-0.5" style={{ background: "var(--gradient-brand)" }} />
        <CardContent className="px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <InfoInline label="Customer" value="Elbit Systems" />
          <InfoInline label="Project" value="Radar Control Board v3" />
          <InfoInline label="Code" value="ELB-RCB-003" />
          <InfoInline label="BOM" value={<span className="font-mono">v4.2</span>} />
          <InfoInline label="Snapshot" value="With China Quote" />
          <InfoInline label="Status" value={<Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-risk-medium/30 text-amber-700 border-risk-medium/50">In Review</Badge>} />
          <InfoInline label="Updated" value="15/06/2026" />
          <InfoInline label="Qty" value="1,000 assemblies" />
        </CardContent>
      </Card>

      {/* Row 2: customer-safe + internal financial KPIs side by side */}
      <div className="grid grid-cols-12 gap-2.5 mb-3">
        <Card className="col-span-12 lg:col-span-4 border-emerald-200/70 bg-emerald-50/40 py-0">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold flex items-center gap-1">
                <Eye className="h-3 w-3" /> Customer-Facing
              </span>
              <Badge variant="outline" className="h-4 px-1.5 border-emerald-300 text-emerald-700 bg-emerald-100/60 text-[9px]">CUSTOMER SAFE</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground">Customer BOM Value</div>
            <div className="text-[26px] font-bold text-emerald-700 leading-tight">$124,800</div>
            <div className="text-[10px] text-muted-foreground">Quoted price · 1,000 assemblies</div>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-8 border-amber-300/60 bg-amber-50/30 py-0">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold flex items-center gap-1">
                <Lock className="h-3 w-3" /> GlinTech Internal
              </span>
              <Badge variant="outline" className="h-4 px-1.5 border-amber-400 text-amber-800 bg-amber-100/70 text-[9px]">INTERNAL ONLY · DO NOT SHARE</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[11px] text-muted-foreground">Internal Procurement Cost</div>
                <div className="text-[24px] font-bold leading-tight">$82,300</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Gross Delta</div>
                <div className="text-[24px] font-bold text-risk-low leading-tight">+$42,500</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Gross Margin</div>
                <div className="text-[24px] font-bold text-risk-low leading-tight">34.1%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: operational KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-3">
        <Kpi label="Critical Parts" value="7" tone="bad" hint="Block production" />
        <Kpi label="Missing Stock" value="9" tone="warn" hint="Below required qty" />
        <Kpi label="EOL / Obsolete" value="2" tone="warn" hint="Lifecycle risk" />
        <Kpi label="Needs Review" value="14" tone="warn" hint="Manual check" />
        <Kpi label="BOM Quality Score" value={<bdi dir="ltr">87 / 100</bdi>} tone="good" hint="Identification level" />
      </div>

      {/* Row 4: charts */}
      <div className="grid grid-cols-12 gap-2.5 mb-3">
        <Card className="col-span-12 lg:col-span-6 py-0">
          <CardHeader className="px-3 pt-2.5 pb-1 flex-row items-center justify-between">
            <CardTitle className="text-[13px]">Customer Price vs Internal Cost — by Category</CardTitle>
            <Badge variant="outline" className="h-4 px-1.5 border-amber-400 text-amber-800 bg-amber-100/70 text-[9px]">INTERNAL</Badge>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={costByCategory} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="customer" fill="var(--brand)" name="Customer Price" radius={[3, 3, 0, 0]} />
                <Bar dataKey="internal" fill="#10b981" name="Internal Cost" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-12 md:col-span-6 lg:col-span-3 py-0">
          <CardHeader className="px-3 pt-2.5 pb-1"><CardTitle className="text-[13px]">Risk Summary</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3 space-y-1.5">
            {riskSummary.map((r) => {
              const pct = (r.value / riskTotal) * 100;
              return (
                <div key={r.name}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-medium">{r.name}</span>
                    <span className="tabular-nums text-muted-foreground">{r.value}</span>
                  </div>
                  <div className="h-1.5 rounded bg-muted overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${pct}%`, background: r.color }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="col-span-12 md:col-span-6 lg:col-span-3 py-0">
          <CardHeader className="px-3 pt-2.5 pb-1"><CardTitle className="text-[13px]">Supplier Strategy</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3 space-y-1.5">
            {supplierStrategy.map((s) => {
              const pct = (s.value / supplierTotal) * 100;
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                      <span className="font-medium">{s.name}</span>
                    </div>
                    <span className="tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-muted overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* BOM version snapshot */}
      <Card className="mb-3 py-0">
        <CardContent className="px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">BOM Version / Pricing Snapshot</span>
          <InfoInline label="Active BOM" value={<span className="font-mono font-semibold">v4.2</span>} />
          <InfoInline label="Snapshot" value="With China Quote" />
          <InfoInline label="China Quote" value={<span className="inline-flex items-center gap-1 text-risk-low font-medium"><CheckCircle2 className="h-3 w-3" /> Yes</span>} />
          <InfoInline label="Official Rep" value={<span className="inline-flex items-center gap-1 text-risk-low font-medium"><CheckCircle2 className="h-3 w-3" /> Yes</span>} />
          <InfoInline label="Last Export" value="Customer PDF · 14/06/2026" />
        </CardContent>
      </Card>

      {/* Row 5: tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
        <Card className="py-0">
          <CardHeader className="px-3 pt-2.5 pb-1 flex-row items-center justify-between">
            <CardTitle className="text-[13px] flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-risk-low" /> Top Savings Opportunities</CardTitle>
            <Badge variant="outline" className="h-4 px-1.5 border-amber-400 text-amber-800 bg-amber-100/70 text-[9px]">INTERNAL</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">MPN</TableHead>
                  <TableHead className="text-right">Manufacturer</TableHead>
                  <TableHead className="text-right tabular-nums">Cust.</TableHead>
                  <TableHead className="text-right tabular-nums">Int.</TableHead>
                  <TableHead className="text-right tabular-nums">Saving</TableHead>
                  <TableHead className="text-right">Source</TableHead>
                  <TableHead className="text-right">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSavings.map((r) => {
                  const save = r.cust - r.intCost;
                  const pct = (save / r.cust) * 100;
                  return (
                    <TableRow key={r.mpn}>
                      <TableCell className="font-mono text-[11px]">{r.mpn}</TableCell>
                      <TableCell className="text-[11px]">{r.mfr}</TableCell>
                      <TableCell className="text-right tabular-nums">${r.cust.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">${r.intCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-risk-low font-semibold">
                        <bdi dir="ltr">${save.toFixed(2)} ({pct.toFixed(0)}%)</bdi>
                      </TableCell>
                      <TableCell className="text-[11px]">{r.source}</TableCell>
                      <TableCell><RiskBadge level={r.risk} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="px-3 pt-2.5 pb-1">
            <CardTitle className="text-[13px] flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-risk-critical" /> Top Risk Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">MPN</TableHead>
                  <TableHead className="text-right">Mfr.</TableHead>
                  <TableHead className="text-right">Risk</TableHead>
                  <TableHead className="text-right">Reason</TableHead>
                  <TableHead className="text-right tabular-nums">Stock</TableHead>
                  <TableHead className="text-right">Lead</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topRisks.map((r) => (
                  <TableRow key={r.mpn}>
                    <TableCell className="font-mono text-[11px]">{r.mpn}</TableCell>
                    <TableCell className="text-[11px]">{r.mfr}</TableCell>
                    <TableCell><RiskBadge level={r.risk} /></TableCell>
                    <TableCell className="text-[11px]">{r.reason}</TableCell>
                    <TableCell className="text-right tabular-nums text-[11px]">{r.stock.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-[11px]">{r.lead}</TableCell>
                    <TableCell className="text-[11px]">{r.action}</TableCell>
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

function InfoInline({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      <span className="font-semibold text-[12px]">{value}</span>
    </span>
  );
}
