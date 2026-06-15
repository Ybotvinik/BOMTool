import Link from "next/link";
import { AlertTriangle, GitBranch, Package, Wallet } from "lucide-react";
import { Card, PageHeader, Kpi, StatusBadge, Badge } from "@/components/ui";

export default function ProjectOverviewPage() {
  return (
    <>
      <PageHeader
        title="Radar Control Board v3"
        subtitle="Elbit Systems · ELB-RCB-003 · Build Qty 1,000"
        actions={<StatusBadge status="In Review" />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Customer BOM Value" value="$412,000" tone="default" />
        <Kpi label="Internal Cost" value="$287,400" tone="default" />
        <Kpi label="Gross Margin" value="30.2%" tone="good" hint="Target 28%" />
        <Kpi label="Critical Parts" value={2} tone="bad" hint="דורש סקירה" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-brand" />
            <h2 className="text-[14px] font-semibold">סיכום BOM</h2>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12.5px]">
            {[
              ["סך רכיבים", "146"],
              ["שורות BOM", "98"],
              ["MPN ייחודיים", "92"],
              ["Lead Time מקסימלי", "16 שב'"],
              ["MOQ חריגים", "4"],
              ["Stock נמוך", "3"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-slate-200 p-2.5">
                <div className="text-slate-500">{k}</div>
                <div className="text-[16px] font-bold tabular-nums mt-0.5">{v}</div>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-risk-medium" />
            <h2 className="text-[14px] font-semibold">סיכון ואיכות</h2>
          </div>
          <ul className="space-y-2 text-[12.5px]">
            <li className="flex items-center justify-between">
              <span>רכיבים קריטיים</span>
              <Badge className="bg-red-50 text-risk-critical border-red-200">2</Badge>
            </li>
            <li className="flex items-center justify-between">
              <span>חוסר התאמת MPN</span>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200">5</Badge>
            </li>
            <li className="flex items-center justify-between">
              <span>BOM Quality Score</span>
              <Badge className="bg-green-50 text-risk-low border-green-200">86%</Badge>
            </li>
          </ul>
          <Link
            href="/bom"
            className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-[12px] font-medium hover:bg-brand/90"
          >
            <GitBranch className="h-3.5 w-3.5" /> פתח טבלת BOM
          </Link>
        </Card>
      </div>

      <Card className="p-4 mt-3">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-4 w-4 text-brand" />
          <h2 className="text-[14px] font-semibold">Pricing Snapshot אחרון</h2>
        </div>
        <p className="text-[12px] text-slate-500">
          Q2-2026 · Internal Cost $287,400 · Customer Price $412,000 · Gross Margin
          30.2%
        </p>
      </Card>
    </>
  );
}
