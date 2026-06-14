import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bomLines } from "@/lib/mock-data";
import { FileSpreadsheet, FileText, Cloud } from "lucide-react";

export const Route = createFileRoute("/export")({
  component: ExportBuilder,
});

const customerFields = ["MPN","Manufacturer","Normalized Description","Qty","Customer Unit Price","Customer Total Price","Availability Status","Lead Time","Lifecycle Status","Customer Notes"];
const internalExtras = ["China Buyer Price","China Supplier","Internal Cost","Gross Margin","Savings","Internal Notes","Internal Recommended Source"];

function ExportBuilder() {
  const [mode, setMode] = useState<"customer" | "internal">("customer");
  const fields = mode === "customer" ? customerFields : [...customerFields, ...internalExtras];

  return (
    <AppLayout>
      <PageHeader title="דוחות וייצוא" subtitle="בניית דוח מותאם ללקוח או לשימוש פנימי" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">סוג הדוח</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-2">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="customer" /> Customer Export</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="internal" /> Internal Export</label>
            </RadioGroup>
            <div className="mt-4 space-y-2">
              <div className="text-xs text-muted-foreground">פורמט:</div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">Excel</Badge>
                <Badge variant="outline">PDF</Badge>
              </div>
            </div>
            {mode === "internal" && (
              <div className="mt-4 p-2 rounded border border-risk-critical/40 bg-risk-critical/10 text-xs font-semibold text-risk-critical text-center">
                GLINTECH INTERNAL ONLY
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">בחירת שדות</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {fields.map(f => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <Checkbox defaultChecked /> {f}
              </label>
            ))}
            {mode === "customer" && internalExtras.map(f => (
              <label key={f} className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                <Checkbox disabled /> {f}
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">תצוגה מקדימה</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>MPN</TableHead><TableHead>Manufacturer</TableHead><TableHead>Description</TableHead><TableHead>Qty</TableHead>
                <TableHead>{mode === "customer" ? "Customer Unit Price" : "Internal Unit Cost"}</TableHead>
                <TableHead>{mode === "customer" ? "Customer Total" : "Internal Total"}</TableHead>
                <TableHead>Lead Time</TableHead><TableHead>Lifecycle</TableHead>
                {mode === "internal" && <><TableHead>China Price</TableHead><TableHead>Savings</TableHead></>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomLines.slice(0, 6).map(l => (
                <TableRow key={l.line}>
                  <TableCell className="font-mono">{l.matchedMpn}</TableCell>
                  <TableCell>{l.manufacturer}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{l.normalizedDesc}</TableCell>
                  <TableCell>{l.requiredQty}</TableCell>
                  <TableCell>${(mode === "customer" ? l.custUnit : l.intUnit).toFixed(2)}</TableCell>
                  <TableCell>${(mode === "customer" ? l.custTotal : l.intTotal).toFixed(0)}</TableCell>
                  <TableCell>{l.leadTime}</TableCell>
                  <TableCell>{l.lifecycle}</TableCell>
                  {mode === "internal" && <><TableCell>${l.intUnit.toFixed(2)}</TableCell><TableCell className="text-risk-low">+${(l.custTotal - l.intTotal).toFixed(0)}</TableCell></>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline"><FileSpreadsheet className="h-4 w-4 ml-1" /> ייצוא Excel</Button>
        <Button variant="outline"><FileText className="h-4 w-4 ml-1" /> ייצוא PDF</Button>
        <Button style={{ background: "var(--gradient-brand)" }} className="text-white">
          <Cloud className="h-4 w-4 ml-1" /> שמירה ב-Google Drive
        </Button>
      </div>
    </AppLayout>
  );
}
