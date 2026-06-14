import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload } from "lucide-react";
import { chinaQuotes } from "@/lib/mock-data";

export const Route = createFileRoute("/china-quote")({
  component: ChinaQuote,
});

function ChinaQuote() {
  return (
    <AppLayout>
      <PageHeader title="טעינת מחירון סין" subtitle="עיבוד מחירונים מספק China Buyer והשוואה למחיר לקוח" />

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">העלאת קובץ הצעת מחיר</CardTitle></CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/30">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm">גרור קובץ Excel של China Buyer Quote</p>
            <Button className="mt-3" variant="outline">בחר קובץ</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi label="Matched Quote Lines" value="138 / 186" tone="good" />
        <Kpi label="Total Internal Cost" value="$142,100" />
        <Kpi label="Estimated Savings" value="$42,250" tone="good" />
        <Kpi label="Lines with Better China Price" value="112" tone="good" />
        <Kpi label="Lines Requiring Approval" value="9" tone="warn" />
      </div>

      <Card className="overflow-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              {["MPN","Supplier","Unit Price","Currency","MOQ","Available","Lead Time","Quote Date","Valid Until","Cust Price","Δ vs Customer","Status"].map(h => <TableHead key={h}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {chinaQuotes.map((q) => {
              const delta = q.custPrice - q.unitPrice;
              return (
                <TableRow key={q.mpn}>
                  <TableCell className="font-mono">{q.mpn}</TableCell>
                  <TableCell>{q.supplier}</TableCell>
                  <TableCell className="tabular-nums">${q.unitPrice.toFixed(2)}</TableCell>
                  <TableCell>{q.currency}</TableCell>
                  <TableCell>{q.moq}</TableCell>
                  <TableCell>{q.available.toLocaleString()}</TableCell>
                  <TableCell>{q.leadTime}</TableCell>
                  <TableCell>{q.date}</TableCell>
                  <TableCell>{q.validUntil}</TableCell>
                  <TableCell className="tabular-nums">${q.custPrice.toFixed(2)}</TableCell>
                  <TableCell className="tabular-nums text-risk-low font-medium">-${delta.toFixed(2)}</TableCell>
                  <TableCell><Badge variant="outline" className="bg-risk-low/15 text-risk-low border-risk-low/30">Matched</Badge></TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell className="font-mono">UNKNOWN-X1</TableCell>
              <TableCell colSpan={10} className="text-muted-foreground">לא נמצאה התאמה ב-BOM · הצעת alternative: STM32F405RGT6</TableCell>
              <TableCell><Badge variant="outline" className="bg-risk-medium/30 text-amber-700 border-risk-medium/40">Alt suggested</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
