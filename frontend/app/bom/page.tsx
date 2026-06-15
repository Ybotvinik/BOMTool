import { Card, PageHeader, Badge } from "@/components/ui";
import { bomLines } from "@/lib/mock-data";

const money = (n: number) => `$${n.toFixed(2)}`;

export default function BomTablePage() {
  return (
    <>
      <PageHeader
        title="טבלת BOM"
        subtitle="Radar Control Board v3 · גרסה v3.0"
      />
      <Card className="overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-right">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">MPN</th>
              <th className="px-3 py-2 font-medium">Manufacturer</th>
              <th className="px-3 py-2 font-medium">תיאור</th>
              <th className="px-3 py-2 font-medium text-center">Qty</th>
              <th className="px-3 py-2 font-medium">Internal Cost</th>
              <th className="px-3 py-2 font-medium">Customer Price</th>
              <th className="px-3 py-2 font-medium text-center">קריטי</th>
            </tr>
          </thead>
          <tbody>
            {bomLines.map((l) => (
              <tr key={l.lineNo} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2 text-slate-400 tabular-nums">{l.lineNo}</td>
                <td className="px-3 py-2 font-medium tabular-nums">{l.mpn}</td>
                <td className="px-3 py-2">{l.manufacturer}</td>
                <td className="px-3 py-2 text-slate-600">{l.description}</td>
                <td className="px-3 py-2 text-center tabular-nums">{l.qty}</td>
                <td className="px-3 py-2 tabular-nums">{money(l.internalCost)}</td>
                <td className="px-3 py-2 tabular-nums">{money(l.customerPrice)}</td>
                <td className="px-3 py-2 text-center">
                  {l.critical ? (
                    <Badge className="bg-red-50 text-risk-critical border-red-200">
                      Critical
                    </Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
