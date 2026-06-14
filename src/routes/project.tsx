import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/project")({
  component: ProjectOverview,
});

const compare = [
  { name: "Power", customer: 12400, internal: 8900 },
  { name: "MCU", customer: 18200, internal: 13800 },
  { name: "FPGA", customer: 68500, internal: 54200 },
  { name: "Passive", customer: 6200, internal: 3100 },
  { name: "Connector", customer: 9800, internal: 7200 },
];
const risk = [
  { name: "Low", value: 142, color: "var(--risk-low)" },
  { name: "Medium", value: 28, color: "var(--risk-medium)" },
  { name: "High", value: 9, color: "var(--risk-high)" },
  { name: "Critical", value: 5, color: "var(--risk-critical)" },
  { name: "Obsolete", value: 2, color: "var(--risk-obsolete)" },
];
const supplier = [
  { name: "China Buyer", value: 92 },
  { name: "Official Rep", value: 48 },
  { name: "Digi-Key", value: 28 },
  { name: "Mouser", value: 18 },
];
const topCost = [
  { name: "XC7A35T FPGA", value: 6850 },
  { name: "STM32F407", value: 842 },
  { name: "AD7920 ADC", value: 680 },
  { name: "PIC16F877A", value: 560 },
  { name: "ADXL345", value: 485 },
];
const topSavings = [
  { name: "STM32F407", value: 264 },
  { name: "ADXL345", value: 173 },
  { name: "MAX232", value: 117 },
  { name: "TPS54331", value: 56 },
  { name: "LM358", value: 48 },
];

function ProjectOverview() {
  return (
    <AppLayout>
      <PageHeader title="סקירת פרויקט" subtitle="Elbit Systems · Radar Control Board v3" />

      <Card className="mb-6">
        <CardContent className="p-5 grid grid-cols-2 md:grid-cols-7 gap-4 text-sm">
          <Info label="Customer" value="Elbit Systems" />
          <Info label="Project" value="Radar Control Board v3" />
          <Info label="Project Code" value="ELB-RCB-003" />
          <Info label="Active BOM" value="v4.2" />
          <Info label="Pricing Snapshot" value="2026-06-12" />
          <Info label="Status" value={<Badge variant="outline" className="bg-risk-medium/30 text-amber-700 border-risk-medium/50">In Review</Badge>} />
          <Info label="Last Updated" value="2026-06-12 14:32" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Kpi label="Customer BOM Value" value="$184,350" />
        <Kpi label="Internal Procurement Cost" value="$142,100" />
        <Kpi label="Gross Delta" value="+$42,250" tone="good" />
        <Kpi label="Gross Margin %" value="22.9%" tone="good" />
        <Kpi label="Critical Parts" value="7" tone="bad" />
        <Kpi label="Missing Stock" value="3" tone="warn" />
        <Kpi label="EOL / Obsolete" value="2" tone="warn" />
        <Kpi label="Needs Review" value="14" tone="warn" />
        <Kpi label="BOM Quality Score" value="87 / 100" tone="good" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Customer Price vs Internal Cost">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={compare}>
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="customer" fill="var(--brand)" name="Customer" />
              <Bar dataKey="internal" fill="var(--brand-glow)" name="Internal" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Risk Level Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={risk} dataKey="value" nameKey="name" outerRadius={90} label>
                {risk.map((r) => <Cell key={r.name} fill={r.color} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Supplier Strategy">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={supplier} layout="vertical">
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={12} width={90} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--brand)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top Cost Drivers">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topCost} layout="vertical">
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={11} width={100} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--risk-critical)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top Savings Opportunities">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topSavings} layout="vertical">
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={11} width={100} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--risk-low)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </AppLayout>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium mt-1">{value}</div>
    </div>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
