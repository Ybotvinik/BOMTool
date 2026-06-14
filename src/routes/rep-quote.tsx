import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload } from "lucide-react";
import { repQuotes } from "@/lib/mock-data";

export const Route = createFileRoute("/rep-quote")({
  component: RepQuote,
});

function RepQuote() {
  return (
    <AppLayout>
      <PageHeader title="הצעות נציגים רשמיים" subtitle="ניהול הצעות מנציגים מורשים (Arrow, Avnet, Future)" />

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">העלאת הצעת נציג</CardTitle></CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30">
            <Upload className="h-7 w-7 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm">העלה קובץ Excel של Official Rep Quote</p>
            <Button className="mt-3" variant="outline">בחר קובץ</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">השוואת מקורות</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted/50">
                {["MPN","Official Rep","Rep Price","Market (DK/Mouser)","China Buyer","Selected Customer Price","Internal Recommended","MOQ","Lead Time","Valid Until"].map(h => <TableHead key={h}>{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {repQuotes.map((q) => {
                const recommended = q.china !== null && q.china < q.unitPrice ? "China Buyer" : "Official Rep";
                return (
                  <TableRow key={q.mpn}>
                    <TableCell className="font-mono">{q.mpn}</TableCell>
                    <TableCell>{q.rep}</TableCell>
                    <TableCell className="tabular-nums">${q.unitPrice.toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums">${q.market.toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums">{q.china === null ? "—" : `$${q.china.toFixed(2)}`}</TableCell>
                    <TableCell className="tabular-nums font-medium">${q.market.toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-brand/15 text-brand border-brand/30">{recommended}</Badge></TableCell>
                    <TableCell>{q.moq}</TableCell>
                    <TableCell>{q.leadTime}</TableCell>
                    <TableCell>{q.validUntil}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
