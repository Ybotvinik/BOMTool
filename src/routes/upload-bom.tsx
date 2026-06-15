import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, AlertTriangle, FileSpreadsheet, CheckCircle2, Info, ArrowLeftRight, X, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/upload-bom")({
  component: UploadBom,
});

type Conf = "High" | "Medium" | "Low";
const confCls: Record<Conf, string> = {
  High: "bg-risk-low/20 text-risk-low border-risk-low/40",
  Medium: "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
  Low: "bg-risk-critical/20 text-risk-critical border-risk-critical/40",
};

const excelCols = ["A: Part Number", "B: Manuf.", "C: Description", "D: Qty", "E: RefDes", "F: Package", "G: CustPN", "H: Notes", "I: DNP", "J: Value"];

const mappingFields: { field: string; required: boolean; detected: string; conf: Conf }[] = [
  { field: "MPN", required: true, detected: "A: Part Number", conf: "High" },
  { field: "Manufacturer", required: true, detected: "B: Manuf.", conf: "High" },
  { field: "Description", required: true, detected: "C: Description", conf: "High" },
  { field: "Qty per Assembly", required: true, detected: "D: Qty", conf: "High" },
  { field: "Reference Designators", required: false, detected: "E: RefDes", conf: "High" },
  { field: "Package", required: false, detected: "F: Package", conf: "Medium" },
  { field: "Customer Part Number", required: false, detected: "G: CustPN", conf: "Medium" },
  { field: "Notes", required: false, detected: "H: Notes", conf: "Low" },
  { field: "DNP / Optional", required: false, detected: "I: DNP", conf: "Low" },
];

type Status = "Ready" | "Missing MPN" | "Missing Qty" | "Possible Error" | "Needs Review";
const statusCls: Record<Status, string> = {
  Ready: "bg-risk-low/20 text-risk-low border-risk-low/40",
  "Missing MPN": "bg-risk-critical/20 text-risk-critical border-risk-critical/40",
  "Missing Qty": "bg-risk-critical/20 text-risk-critical border-risk-critical/40",
  "Possible Error": "bg-risk-high/20 text-risk-high border-risk-high/40",
  "Needs Review": "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
};

const previewRows: { line: number; mpn: string; mfr: string; desc: string; qty: string; ref: string; pkg: string; status: Status }[] = [
  { line: 1, mpn: "STM32F407VGT6", mfr: "STMicroelectronics", desc: "MCU 32-bit ARM Cortex-M4", qty: "1", ref: "U1", pkg: "LQFP-100", status: "Ready" },
  { line: 2, mpn: "LM358N", mfr: "Texas Instruments", desc: "Dual Op-Amp", qty: "2", ref: "U2,U3", pkg: "DIP-8", status: "Ready" },
  { line: 3, mpn: "TPS54331DR", mfr: "Texas Instruments", desc: "Buck Converter 3A", qty: "1", ref: "U4", pkg: "SOIC-8", status: "Ready" },
  { line: 4, mpn: "XC7A35T-1FTG256C", mfr: "Xilinx / AMD", desc: "FPGA Artix-7", qty: "1", ref: "U5", pkg: "FTBGA-256", status: "Ready" },
  { line: 5, mpn: "ADXL345BCCZ", mfr: "Analog Devices", desc: "Accelerometer 3-axis", qty: "1", ref: "U6", pkg: "LGA-14", status: "Ready" },
  { line: 6, mpn: "", mfr: "Maxim", desc: "RS-232 Driver", qty: "1", ref: "U7", pkg: "DIP-16", status: "Missing MPN" },
  { line: 7, mpn: "BC547B", mfr: "ON Semi", desc: "NPN Transistor", qty: "", ref: "Q1-Q4", pkg: "TO-92", status: "Missing Qty" },
  { line: 8, mpn: "PIC16F877A", mfr: "Microchip", desc: "8-bit MCU", qty: "1", ref: "U8", pkg: "PDIP-40", status: "Needs Review" },
  { line: 9, mpn: "AD7920ARTZ", mfr: "Analog Devices", desc: "ADC 12-bit", qty: "2", ref: "U9,U10", pkg: "SOT-23-6", status: "Needs Review" },
  { line: 10, mpn: "LT1086CT-5", mfr: "Analog Devices", desc: "5V LDO ???", qty: "999", ref: "U11", pkg: "TO-220", status: "Possible Error" },
];

function UploadBom() {
  const [importMode, setImportMode] = useState("new");
  const [uploaded, setUploaded] = useState(true);
  const [imported, setImported] = useState(false);

  return (
    <AppLayout>
      <PageHeader
        title="טעינת BOM"
        subtitle="טעינת קובץ BOM חדש, מיפוי עמודות, יצירת גרסת BOM והשוואה לגרסה קיימת."
      />

      {/* 1. Project selection bar */}
      <Card className="mb-3 py-0">
        <CardContent className="px-3 py-2.5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Customer">
            <Select defaultValue="elbit">
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="elbit">Elbit Systems</SelectItem>
                <SelectItem value="rafael">Rafael</SelectItem>
                <SelectItem value="iai">IAI</SelectItem>
                <SelectItem value="plasan">Plasan</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project">
            <Select defaultValue="rcb">
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rcb">Radar Control Board v3 · ELB-RCB-003</SelectItem>
                <SelectItem value="upd">UAV Power Distribution · RFL-UPD-011</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Current Active BOM Version">
            <Select defaultValue="v42">
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="v42">v4.2 · Active</SelectItem>
                <SelectItem value="v41">v4.1 · Archived</SelectItem>
                <SelectItem value="v40">v4.0 · Archived</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Import Mode">
            <Select value={importMode} onValueChange={setImportMode}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create New BOM Version</SelectItem>
                <SelectItem value="draft">Replace Draft Version</SelectItem>
                <SelectItem value="overwrite">Overwrite Existing Version</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
        {importMode === "overwrite" && (
          <div className="px-3 pb-2.5">
            <Alert className="py-2 border-amber-400 bg-amber-50/60 text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">
                דריסת גרסה תשמור עותק בארכיון אך תחליף את הגרסה הפעילה.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </Card>

      {/* 2. File upload */}
      <Card className="mb-3 py-0">
        <CardHeader className="px-3 pt-2.5 pb-1">
          <CardTitle className="text-[13px] flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-brand text-brand-foreground text-[10px] font-bold">1</span>
            העלאת קובץ
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {!uploaded ? (
            <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 font-medium text-sm">גרור קובץ Excel / CSV לכאן</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">.xlsx · .csv · עד 20MB</p>
              <Button className="mt-3 h-7 text-xs" variant="outline" onClick={() => setUploaded(true)}>בחר קובץ BOM</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <div className="h-9 w-9 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">ELB-RCB_v4.3_customer.xlsx</div>
                <div className="text-[11px] text-muted-foreground">412 KB · הועלה 15/06/2026 14:32 · 186 שורות</div>
              </div>
              <Badge variant="outline" className="h-5 text-[10px] bg-risk-low/20 text-risk-low border-risk-low/40">
                <CheckCircle2 className="h-3 w-3 ml-1" /> הקובץ נטען בהצלחה
              </Badge>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setUploaded(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {uploaded && (
        <>
          {/* 3. Column mapping + 4. preview side-by-side */}
          <div className="grid grid-cols-12 gap-3 mb-3">
            <Card className="col-span-12 xl:col-span-5 py-0">
              <CardHeader className="px-3 pt-2.5 pb-1">
                <CardTitle className="text-[13px] flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-brand text-brand-foreground text-[10px] font-bold">2</span>
                  מיפוי עמודות
                  <Sparkles className="h-3 w-3 text-brand" />
                  <span className="text-[10px] font-normal text-muted-foreground">זוהה אוטומטית</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">Target Field</TableHead>
                      <TableHead className="text-right">Excel Column</TableHead>
                      <TableHead className="text-right">Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappingFields.map((m) => (
                      <TableRow key={m.field}>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{m.field}</span>
                            {m.required ? (
                              <Badge variant="outline" className="h-4 px-1 text-[9px] bg-brand/10 text-brand border-brand/30">REQUIRED</Badge>
                            ) : (
                              <span className="text-[9px] text-muted-foreground uppercase">optional</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-1">
                          <Select defaultValue={m.detected}>
                            <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— לא ממופה —</SelectItem>
                              {excelCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`h-4 px-1.5 text-[10px] ${confCls[m.conf]}`}>{m.conf}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="col-span-12 xl:col-span-7 py-0">
              <CardHeader className="px-3 pt-2.5 pb-1">
                <CardTitle className="text-[13px] flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-brand text-brand-foreground text-[10px] font-bold">3</span>
                  תצוגה מקדימה — 10 שורות ראשונות
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right tabular-nums">Line</TableHead>
                      <TableHead className="text-right">MPN</TableHead>
                      <TableHead className="text-right">Manufacturer</TableHead>
                      <TableHead className="text-right">Description</TableHead>
                      <TableHead className="text-right tabular-nums">Qty</TableHead>
                      <TableHead className="text-right">RefDes</TableHead>
                      <TableHead className="text-right">Package</TableHead>
                      <TableHead className="text-right">Mapping Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((r) => (
                      <TableRow key={r.line}>
                        <TableCell className="text-right tabular-nums text-[11px]">{r.line}</TableCell>
                        <TableCell className="font-mono text-[11px]">{r.mpn || <span className="text-risk-critical">—</span>}</TableCell>
                        <TableCell className="text-[11px]">{r.mfr}</TableCell>
                        <TableCell className="text-[11px]">{r.desc}</TableCell>
                        <TableCell className="text-right tabular-nums text-[11px]">{r.qty || <span className="text-risk-critical">—</span>}</TableCell>
                        <TableCell className="text-[11px]">{r.ref}</TableCell>
                        <TableCell className="text-[11px]">{r.pkg}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`h-4 px-1.5 text-[10px] ${statusCls[r.status]}`}>{r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* 5. Validation KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-3">
            <Kpi label="Total Rows Detected" value="186" />
            <Kpi label="Rows Ready to Import" value="168" tone="good" />
            <Kpi label="Missing MPN" value="4" tone="bad" />
            <Kpi label="Missing Qty" value="2" tone="bad" />
            <Kpi label="Duplicate MPNs" value="3" tone="warn" />
            <Kpi label="Needs Review" value="14" tone="warn" />
          </div>

          {/* 7. Business rule */}
          <Alert className="mb-3 py-2 border-brand/30 bg-brand/5">
            <Info className="h-3.5 w-3.5 text-brand" />
            <AlertDescription className="text-xs text-foreground">
              <span className="font-semibold">MPN הוא השדה המוביל לזיהוי הרכיב.</span>{" "}
              תיאור הלקוח נשמר כ-<span className="font-mono text-[11px]">Original Description</span>, ותיאור תקני יתווסף בהמשך כ-<span className="font-mono text-[11px]">Normalized Description</span> ממקורות כגון Digi-Key או Mouser.
            </AlertDescription>
          </Alert>

          {/* 6. Actions */}
          <div className="flex flex-wrap justify-end gap-1.5 mb-3">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setUploaded(false)}>ביטול</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <ArrowLeftRight className="h-3.5 w-3.5 ml-1" /> ייבוא והשוואה לגרסה פעילה
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={() => setImported(true)} style={{ background: "var(--gradient-brand)" }}>
              <Upload className="h-3.5 w-3.5 ml-1" /> ייבוא BOM
            </Button>
          </div>

          {/* 8. Success state */}
          {imported && (
            <Card className="border-emerald-300 bg-emerald-50/40 py-0">
              <CardContent className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-emerald-800">הייבוא הושלם בהצלחה</div>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      <SuccessItem label="Created BOM Version" value={<span className="font-mono font-semibold">v4.3</span>} />
                      <SuccessItem label="Saved to" value={<span className="font-mono text-[11px]">01_Source_BOM/</span>} />
                      <SuccessItem label="Rows Imported" value="186" />
                      <SuccessItem label="Needs Review" value={<span className="text-amber-700 font-semibold">14</span>} />
                      <SuccessItem label="Next Action" value={<span className="text-brand font-semibold">Run BOM Cleanup & Pricing →</span>} />
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setImported(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function SuccessItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
