import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Folder, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/files")({
  component: Files,
});

const folders = [
  { name: "01_Source_BOM", count: 4 },
  { name: "02_China_Quotes", count: 7 },
  { name: "03_Official_Rep_Quotes", count: 3 },
  { name: "04_Processed_BOM", count: 4 },
  { name: "05_Customer_Exports", count: 6 },
  { name: "06_Internal_Reports", count: 5 },
  { name: "07_Procurement_RFQ", count: 2 },
  { name: "08_Archive", count: 12 },
];

const files = [
  { name: "ELB-RCB_v4.2.xlsx", type: "Source BOM", version: "v4.2", by: "Yossi Cohen", date: "2026-06-12" },
  { name: "China_Quote_Huaqiang_2026-06-01.xlsx", type: "China Quote", version: "—", by: "Dana Levi", date: "2026-06-01" },
  { name: "Avnet_Rep_Quote_2026-06-05.xlsx", type: "Rep Quote", version: "—", by: "Yossi Cohen", date: "2026-06-05" },
  { name: "ELB-RCB_Customer_Export_v4.2.xlsx", type: "Customer Export", version: "v4.2", by: "System", date: "2026-06-12" },
  { name: "ELB-RCB_Internal_Report_v4.2.pdf", type: "Internal Report", version: "v4.2", by: "System", date: "2026-06-12" },
];

function Files() {
  return (
    <AppLayout>
      <PageHeader title="קבצי פרויקט" subtitle="Google Shared Drive · ELB-RCB-003" />

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">מבנה תיקיות</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {folders.map(f => (
            <div key={f.name} className="border rounded-lg p-3 flex items-center gap-3 hover:bg-muted/40 cursor-pointer">
              <Folder className="h-5 w-5 text-brand" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <div className="text-[11px] text-muted-foreground">{f.count} files</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">קבצים אחרונים</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {["File Name","Type","Version","Uploaded By","Uploaded Date","Drive"].map(h => <TableHead key={h}>{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map(f => (
                <TableRow key={f.name}>
                  <TableCell className="font-mono text-xs">{f.name}</TableCell>
                  <TableCell>{f.type}</TableCell>
                  <TableCell>{f.version}</TableCell>
                  <TableCell>{f.by}</TableCell>
                  <TableCell>{f.date}</TableCell>
                  <TableCell><Button size="sm" variant="outline"><ExternalLink className="h-3 w-3 ml-1" /> Open in Drive</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
