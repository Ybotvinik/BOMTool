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
  Upload, AlertTriangle, FileSpreadsheet, CheckCircle2, Info, ArrowLeftRight, X, Sparkles, Cpu, Package as PackageIcon,
} from "lucide-react";

export const Route = createFileRoute("/upload-bom")({
  component: UploadBom,
});

type BomType = "pcb" | "product";

type Conf = "High" | "Medium" | "Low";
const confCls: Record<Conf, string> = {
  High: "bg-risk-low/20 text-risk-low border-risk-low/40",
  Medium: "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
  Low: "bg-risk-critical/20 text-risk-critical border-risk-critical/40",
};

const pcbExcelCols = ["A: Part Number", "B: Manuf.", "C: Description", "D: Qty", "E: RefDes", "F: Footprint", "G: Value", "H: SupplierPN", "I: DNP", "J: Package", "K: Notes"];
const prodExcelCols = ["A: Item Name", "B: Item Type", "C: Description", "D: Qty", "E: MPN", "F: Manuf.", "G: Supplier", "H: Internal PN", "I: Drawing", "J: Revision", "K: Make/Buy", "L: Material", "M: Notes"];

type MappingField = { field: string; required: boolean; detected: string; conf: Conf };

const pcbMapping: MappingField[] = [
  { field: "MPN", required: true, detected: "A: Part Number", conf: "High" },
  { field: "Manufacturer", required: true, detected: "B: Manuf.", conf: "High" },
  { field: "Description", required: true, detected: "C: Description", conf: "High" },
  { field: "Qty per Assembly", required: true, detected: "D: Qty", conf: "High" },
  { field: "Reference Designators", required: false, detected: "E: RefDes", conf: "High" },
  { field: "Footprint", required: false, detected: "F: Footprint", conf: "Medium" },
  { field: "Value", required: false, detected: "G: Value", conf: "Medium" },
  { field: "Supplier Part Number", required: false, detected: "H: SupplierPN", conf: "Medium" },
  { field: "Assembly / DNP", required: false, detected: "I: DNP", conf: "Medium" },
  { field: "Package", required: false, detected: "J: Package", conf: "Low" },
  { field: "Notes", required: false, detected: "K: Notes", conf: "Low" },
];

const prodMapping: MappingField[] = [
  { field: "Item Name / Part Name", required: true, detected: "A: Item Name", conf: "High" },
  { field: "Item Type", required: true, detected: "B: Item Type", conf: "High" },
  { field: "Description", required: true, detected: "C: Description", conf: "High" },
  { field: "Qty per Product", required: true, detected: "D: Qty", conf: "High" },
  { field: "MPN / Supplier PN", required: false, detected: "E: MPN", conf: "Medium" },
  { field: "Manufacturer", required: false, detected: "F: Manuf.", conf: "Medium" },
  { field: "Supplier", required: false, detected: "G: Supplier", conf: "Medium" },
  { field: "Internal Part Number", required: false, detected: "H: Internal PN", conf: "Medium" },
  { field: "Drawing / File Link", required: false, detected: "I: Drawing", conf: "Low" },
  { field: "Revision", required: false, detected: "J: Revision", conf: "Low" },
  { field: "Make / Buy", required: false, detected: "K: Make/Buy", conf: "Low" },
  { field: "Material", required: false, detected: "L: Material", conf: "Low" },
  { field: "Notes", required: false, detected: "M: Notes", conf: "Low" },
];

type Status = "Ready" | "Missing MPN" | "Missing Qty" | "Possible Error" | "Needs Review" | "DNP" | "Missing Item Type" | "Warning";
const statusCls: Record<Status, string> = {
  Ready: "bg-risk-low/20 text-risk-low border-risk-low/40",
  "Missing MPN": "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
  "Missing Qty": "bg-risk-critical/20 text-risk-critical border-risk-critical/40",
  "Missing Item Type": "bg-risk-critical/20 text-risk-critical border-risk-critical/40",
  "Possible Error": "bg-risk-high/20 text-risk-high border-risk-high/40",
  "Needs Review": "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
  DNP: "bg-slate-200 text-slate-700 border-slate-300",
  Warning: "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
};

type PcbRow = {
  line: number; mpn: string; mfr: string; desc: string; qty: string;
  ref: string; footprint: string; value: string; dnp: boolean; status: Status;
};

const pcbPreview: PcbRow[] = [
  { line: 1, mpn: "STM32F407VGT6", mfr: "STMicroelectronics", desc: "MCU 32-bit ARM Cortex-M4", qty: "1", ref: "U1", footprint: "LQFP-100", value: "—", dnp: false, status: "Ready" },
  { line: 2, mpn: "GRM188R71H104KA93D", mfr: "Murata", desc: "Cap Ceramic 100nF 50V X7R", qty: "24", ref: "C1-C24", footprint: "0603", value: "100nF", dnp: false, status: "Ready" },
  { line: 3, mpn: "RC0603FR-0710KL", mfr: "Yageo", desc: "Resistor 10k 1% 0603", qty: "12", ref: "R1-R12", footprint: "0603", value: "10k", dnp: false, status: "Ready" },
  { line: 4, mpn: "TPS54331DR", mfr: "Texas Instruments", desc: "Buck Converter 3A", qty: "1", ref: "U4", footprint: "SOIC-8", value: "—", dnp: false, status: "Ready" },
  { line: 5, mpn: "XC7A35T-1FTG256C", mfr: "Xilinx / AMD", desc: "FPGA Artix-7", qty: "1", ref: "U5", footprint: "FTBGA-256", value: "—", dnp: false, status: "Ready" },
  { line: 6, mpn: "ADXL345BCCZ", mfr: "Analog Devices", desc: "Accelerometer 3-axis", qty: "1", ref: "U6", footprint: "LGA-14", value: "—", dnp: false, status: "Ready" },
  { line: 7, mpn: "GRM21BR71H105KA12L", mfr: "Murata", desc: "Cap Ceramic 1uF 50V X7R", qty: "2", ref: "C25,C26", footprint: "0805", value: "1uF", dnp: true, status: "DNP" },
  { line: 8, mpn: "", mfr: "Maxim", desc: "RS-232 Driver", qty: "1", ref: "U7", footprint: "SOIC-16", value: "—", dnp: false, status: "Missing MPN" },
  { line: 9, mpn: "BC547B", mfr: "ON Semi", desc: "NPN Transistor", qty: "", ref: "Q1-Q4", footprint: "SOT-23", value: "—", dnp: false, status: "Missing Qty" },
  { line: 10, mpn: "LT1086CT-5", mfr: "Analog Devices", desc: "5V LDO ???", qty: "999", ref: "—", footprint: "—", value: "5V", dnp: false, status: "Possible Error" },
];

type ProdRow = {
  line: number; itemType: string; name: string; desc: string; qty: string;
  mpn: string; mfr: string; supplier: string; drawing: string; revision: string; status: Status;
};

const prodPreview: ProdRow[] = [
  { line: 1, itemType: "PCB Assembly", name: "Main Control PCBA", desc: "Radar Control Board v3 assembled", qty: "1", mpn: "ELB-RCB-003-A", mfr: "GlinTech", supplier: "Internal", drawing: "DWG-1001 Rev C", revision: "C", status: "Ready" },
  { line: 2, itemType: "Cable", name: "Power Harness 24V", desc: "24V cable assembly 1.5m", qty: "1", mpn: "PWR-HARN-024", mfr: "Custom", supplier: "Local Vendor", drawing: "DWG-2010 Rev B", revision: "B", status: "Ready" },
  { line: 3, itemType: "Mechanical Part", name: "Aluminum Housing", desc: "CNC machined enclosure 6061-T6", qty: "1", mpn: "—", mfr: "Custom", supplier: "CNC Shop", drawing: "DWG-3050 Rev A", revision: "A", status: "Ready" },
  { line: 4, itemType: "Plastic Part", name: "Front Bezel", desc: "ABS injection molded front bezel", qty: "1", mpn: "—", mfr: "Custom", supplier: "Plast Co", drawing: "DWG-3120 Rev A", revision: "A", status: "Ready" },
  { line: 5, itemType: "Fastener", name: "Screw M3x8 SS", desc: "Phillips pan head stainless", qty: "16", mpn: "ISO7045-M3x8", mfr: "Bossard", supplier: "Bossard", drawing: "—", revision: "—", status: "Ready" },
  { line: 6, itemType: "Label / Sticker", name: "Product ID Label", desc: "Serial + barcode label 30x15mm", qty: "1", mpn: "—", mfr: "Custom", supplier: "Print Shop", drawing: "DWG-9001 Rev A", revision: "A", status: "Ready" },
  { line: 7, itemType: "Power Supply", name: "AC/DC 24V 60W", desc: "Mean Well industrial PSU", qty: "1", mpn: "RS-60-24", mfr: "Mean Well", supplier: "Digi-Key", drawing: "—", revision: "—", status: "Ready" },
  { line: 8, itemType: "Packaging", name: "Carton Box + Foam", desc: "Custom shipping carton w/ foam", qty: "1", mpn: "—", mfr: "Custom", supplier: "Pack Co", drawing: "—", revision: "—", status: "Warning" },
  { line: 9, itemType: "Mechanical Part", name: "Heat Sink", desc: "Extruded aluminum heat sink", qty: "2", mpn: "—", mfr: "Custom", supplier: "—", drawing: "—", revision: "—", status: "Warning" },
  { line: 10, itemType: "", name: "Unknown Item", desc: "Generic spacer", qty: "4", mpn: "—", mfr: "—", supplier: "—", drawing: "—", revision: "—", status: "Missing Item Type" },
];

function UploadBom() {
  const [bomType, setBomType] = useState<BomType>("pcb");
  const [importMode, setImportMode] = useState("new");
  const [uploaded, setUploaded] = useState(true);
  const [imported, setImported] = useState(false);

  const isPcb = bomType === "pcb";
  const mapping = isPcb ? pcbMapping : prodMapping;
  const excelCols = isPcb ? pcbExcelCols : prodExcelCols;
  const bomTypeLabel = isPcb ? "PCB / SMT Assembly BOM" : "Product / Mechanical BOM";

  return (
    <AppLayout>
      <PageHeader
        title="טעינת BOM"
        subtitle="טעינת קובץ BOM חדש, מיפוי עמודות, יצירת גרסת BOM והשוואה לגרסה קיימת."
      />

      {/* 1. Project + BOM Type bar */}
      <Card className="mb-3 py-0">
        <CardContent className="px-3 py-2.5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
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
          <Field
            label={
              <span className="flex items-center gap-1">
                BOM Type
                <Badge variant="outline" className="h-3.5 px-1 text-[8px] bg-brand/10 text-brand border-brand/30">REQUIRED</Badge>
              </span>
            }
          >
            <Select value={bomType} onValueChange={(v) => setBomType(v as BomType)}>
              <SelectTrigger className="h-8 text-xs border-brand/50 bg-brand/5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pcb">
                  <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> PCB / SMT Assembly BOM</span>
                </SelectItem>
                <SelectItem value="product">
                  <span className="flex items-center gap-1.5"><PackageIcon className="h-3 w-3" /> Product / Mechanical BOM</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
        <div className="px-3 pb-2.5 -mt-1">
          <p className="text-[11px] text-muted-foreground leading-snug">
            כל BOM נטען בנפרד. בחר האם הקובץ הוא BOM של כרטיס אלקטרוני להרכבת SMT/THT או BOM מוצר/מכאניקה הכולל כבלים, חלקים מכאניים, אריזה ותתי-הרכבות.
          </p>
        </div>
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
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-brand/10 text-brand border-brand/30 mr-1">
              {isPcb ? <Cpu className="h-2.5 w-2.5 ml-0.5" /> : <PackageIcon className="h-2.5 w-2.5 ml-0.5" />}
              {bomTypeLabel}
            </Badge>
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
                <div className="text-sm font-semibold truncate">
                  {isPcb ? "ELB-RCB_v4.3_customer.xlsx" : "ELB-RCB_Product_BOM_v1.2.xlsx"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  412 KB · הועלה 15/06/2026 14:32 · {isPcb ? "186" : "42"} שורות
                </div>
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
          {/* 3. Column mapping + 4. preview */}
          <div className="grid grid-cols-12 gap-3 mb-3">
            <Card className="col-span-12 xl:col-span-5 py-0">
              <CardHeader className="px-3 pt-2.5 pb-1">
                <CardTitle className="text-[13px] flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-brand text-brand-foreground text-[10px] font-bold">2</span>
                  מיפוי עמודות — {bomTypeLabel}
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
                    {mapping.map((m) => (
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
              <CardContent className="p-0 overflow-x-auto">
                {isPcb ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right tabular-nums">Line</TableHead>
                        <TableHead className="text-right">BOM Type</TableHead>
                        <TableHead className="text-right">MPN</TableHead>
                        <TableHead className="text-right">Manufacturer</TableHead>
                        <TableHead className="text-right">Description</TableHead>
                        <TableHead className="text-right tabular-nums">Qty / Asm</TableHead>
                        <TableHead className="text-right">RefDes</TableHead>
                        <TableHead className="text-right">Footprint</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Asm / DNP</TableHead>
                        <TableHead className="text-right">Mapping Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pcbPreview.map((r) => (
                        <TableRow key={r.line} className={r.dnp ? "opacity-60" : ""}>
                          <TableCell className="text-right tabular-nums text-[11px]">{r.line}</TableCell>
                          <TableCell><Badge variant="outline" className="h-4 px-1 text-[9px] bg-brand/10 text-brand border-brand/30">PCB</Badge></TableCell>
                          <TableCell className="font-mono text-[11px]">{r.mpn || <span className="text-amber-700">—</span>}</TableCell>
                          <TableCell className="text-[11px]">{r.mfr}</TableCell>
                          <TableCell className="text-[11px]">{r.desc}</TableCell>
                          <TableCell className="text-right tabular-nums text-[11px]">{r.qty || <span className="text-risk-critical">—</span>}</TableCell>
                          <TableCell className="text-[11px] font-mono">{r.ref}</TableCell>
                          <TableCell className="text-[11px]">{r.footprint}</TableCell>
                          <TableCell className="text-[11px] font-mono">{r.value}</TableCell>
                          <TableCell>
                            {r.dnp
                              ? <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-slate-200 text-slate-700 border-slate-300">DNP · Do Not Populate</Badge>
                              : <span className="text-[10px] text-muted-foreground">Assemble</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`h-4 px-1.5 text-[10px] ${statusCls[r.status]}`}>{r.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right tabular-nums">Line</TableHead>
                        <TableHead className="text-right">BOM Type</TableHead>
                        <TableHead className="text-right">Item Type</TableHead>
                        <TableHead className="text-right">Item Name</TableHead>
                        <TableHead className="text-right">Description</TableHead>
                        <TableHead className="text-right tabular-nums">Qty / Prod</TableHead>
                        <TableHead className="text-right">MPN / Sup PN</TableHead>
                        <TableHead className="text-right">Manufacturer</TableHead>
                        <TableHead className="text-right">Supplier</TableHead>
                        <TableHead className="text-right">Drawing</TableHead>
                        <TableHead className="text-right">Rev</TableHead>
                        <TableHead className="text-right">Mapping Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prodPreview.map((r) => (
                        <TableRow key={r.line}>
                          <TableCell className="text-right tabular-nums text-[11px]">{r.line}</TableCell>
                          <TableCell><Badge variant="outline" className="h-4 px-1 text-[9px] bg-brand/10 text-brand border-brand/30">PROD</Badge></TableCell>
                          <TableCell className="text-[11px]">
                            {r.itemType
                              ? <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-muted">{r.itemType}</Badge>
                              : <span className="text-risk-critical">—</span>}
                          </TableCell>
                          <TableCell className="text-[11px] font-medium">{r.name}</TableCell>
                          <TableCell className="text-[11px]">{r.desc}</TableCell>
                          <TableCell className="text-right tabular-nums text-[11px]">{r.qty || <span className="text-risk-critical">—</span>}</TableCell>
                          <TableCell className="font-mono text-[11px]">{r.mpn}</TableCell>
                          <TableCell className="text-[11px]">{r.mfr}</TableCell>
                          <TableCell className="text-[11px]">{r.supplier}</TableCell>
                          <TableCell className="text-[11px]">{r.drawing}</TableCell>
                          <TableCell className="text-[11px]">{r.revision}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`h-4 px-1.5 text-[10px] ${statusCls[r.status]}`}>{r.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 5. Validation KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-3">
            <Kpi
              label="BOM Type"
              value={isPcb ? "PCB / SMT" : "Product / Mech"}
            />
            <Kpi label="Total Rows Detected" value={isPcb ? "186" : "42"} />
            <Kpi label="Rows Ready to Import" value={isPcb ? "168" : "38"} tone="good" />
            <Kpi label={isPcb ? "Missing MPN" : "Missing MPN / PN"} value={isPcb ? "4" : "9"} tone="warn" />
            <Kpi label="Missing Qty" value={isPcb ? "2" : "1"} tone="bad" />
            <Kpi label="DNP Rows" value={isPcb ? "11" : "—"} />
            <Kpi label="Needs Review" value={isPcb ? "14" : "5"} tone="warn" />
          </div>

          {/* 7. Business rule */}
          <Alert className="mb-3 py-2 border-brand/30 bg-brand/5">
            <Info className="h-3.5 w-3.5 text-brand" />
            <AlertDescription className="text-xs text-foreground">
              {isPcb ? (
                <>
                  <span className="font-semibold">MPN הוא השדה המוביל לזיהוי הרכיב.</span>{" "}
                  תיאור הלקוח נשמר כ-<span className="font-mono text-[11px]">Original Description</span>, ותיאור תקני יתווסף בהמשך כ-<span className="font-mono text-[11px]">Normalized Description</span> ממקורות כגון Digi-Key או Mouser.
                </>
              ) : (
                <>
                  <span className="font-semibold">Item Type הוא השדה המוביל ב-Product BOM.</span>{" "}
                  פריטים מותאמים אישית (מכאניקה, כבלים, אריזה, עבודה) יכולים להיות ללא MPN. עבור פריטים מכאניים וכבלים — מומלץ Drawing + Revision.
                </>
              )}
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
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
                      <SuccessItem label="BOM Type" value={<span className="font-semibold">{bomTypeLabel}</span>} />
                      <SuccessItem label="Created BOM Version" value={<span className="font-mono font-semibold">v4.3</span>} />
                      <SuccessItem label="Saved to" value={<span className="font-mono text-[11px]">01_Source_BOM/</span>} />
                      <SuccessItem label="Rows Imported" value={isPcb ? "186" : "42"} />
                      <SuccessItem label="Needs Review" value={<span className="text-amber-700 font-semibold">{isPcb ? "14" : "5"}</span>} />
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

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
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
