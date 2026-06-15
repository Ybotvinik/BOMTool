import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, FileSpreadsheet, CheckCircle2, X, Sparkles, Lock, ShieldAlert,
  Calculator, Filter, FileDown, ArrowLeftRight, Info, Send, Camera, CheckSquare,
} from "lucide-react";

export const Route = createFileRoute("/china-quote")({
  component: ChinaQuotePage,
});

type Conf = "High" | "Medium" | "Low";
const confCls: Record<Conf, string> = {
  High: "bg-risk-low/20 text-risk-low border-risk-low/40",
  Medium: "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
  Low: "bg-risk-critical/20 text-risk-critical border-risk-critical/40",
};

const excelCols = [
  "A: MPN", "B: Manuf.", "C: Supplier", "D: Unit Price", "E: Currency",
  "F: MOQ", "G: Available", "H: Lead Time", "I: Quote Date", "J: Valid Until",
  "K: Notes", "L: Alt PN",
];

const mappingFields: { field: string; required: boolean; detected: string; conf: Conf }[] = [
  { field: "MPN", required: true, detected: "A: MPN", conf: "High" },
  { field: "Unit Price", required: true, detected: "D: Unit Price", conf: "High" },
  { field: "Currency", required: true, detected: "E: Currency", conf: "High" },
  { field: "Supplier Name", required: true, detected: "C: Supplier", conf: "High" },
  { field: "Manufacturer", required: false, detected: "B: Manuf.", conf: "High" },
  { field: "MOQ", required: false, detected: "F: MOQ", conf: "High" },
  { field: "Available Qty", required: false, detected: "G: Available", conf: "Medium" },
  { field: "Lead Time", required: false, detected: "H: Lead Time", conf: "Medium" },
  { field: "Quote Date", required: false, detected: "I: Quote Date", conf: "Medium" },
  { field: "Valid Until", required: false, detected: "J: Valid Until", conf: "Medium" },
  { field: "Notes", required: false, detected: "K: Notes", conf: "Low" },
  { field: "Alternative PN", required: false, detected: "L: Alt PN", conf: "Low" },
];

type MatchStatus = "Exact Match" | "Partial Match" | "Alternative Suggested" | "Not Matched" | "Needs Review";
const matchCls: Record<MatchStatus, string> = {
  "Exact Match": "bg-risk-low/20 text-risk-low border-risk-low/40",
  "Partial Match": "bg-blue-100 text-blue-700 border-blue-300",
  "Alternative Suggested": "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
  "Not Matched": "bg-risk-critical/20 text-risk-critical border-risk-critical/40",
  "Needs Review": "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
};

type Risk = "Low" | "Medium" | "High" | "Critical";
const riskCls: Record<Risk, string> = {
  Low: "bg-risk-low/20 text-risk-low border-risk-low/40",
  Medium: "bg-risk-medium/30 text-amber-700 border-risk-medium/50",
  High: "bg-risk-high/25 text-risk-high border-risk-high/50",
  Critical: "bg-risk-critical/20 text-risk-critical border-risk-critical/40",
};

type Row = {
  line: number;
  bomMpn: string;
  quoteMpn: string;
  match: MatchStatus;
  mfr: string;
  supplier: string;
  custUnit: number;
  chinaUnit: number | null;
  requiredQty: number;
  availableQty: number;
  moq: number;
  leadTime: string;
  validUntil: string;
  altPn: string;
  risk: Risk;
  decision: string;
  desc: string;
  custSource: string;
  custStock: number;
  custLead: string;
  quoteDate: string;
  notes: string;
  currency: string;
};

const rows: Row[] = [
  { line: 1, bomMpn: "STM32F407VGT6", quoteMpn: "STM32F407VGT6", match: "Exact Match", mfr: "STMicroelectronics", supplier: "Huaqiang HK", custUnit: 8.42, chinaUnit: 5.78, requiredQty: 1000, availableQty: 12450, moq: 100, leadTime: "10w", validUntil: "2026-08-01", altPn: "—", risk: "Low", decision: "Use China Price", desc: "MCU 32-bit ARM Cortex-M4 168MHz LQFP-100", custSource: "Digi-Key", custStock: 8200, custLead: "Stock", quoteDate: "2026-06-10", notes: "Batch tested, RoHS", currency: "USD" },
  { line: 2, bomMpn: "LM358N", quoteMpn: "LM358N", match: "Exact Match", mfr: "Texas Instruments", supplier: "Shenzhen ECP", custUnit: 0.42, chinaUnit: 0.18, requiredQty: 2000, availableQty: 50000, moq: 500, leadTime: "4w", validUntil: "2026-08-15", altPn: "—", risk: "Low", decision: "Use China Price", desc: "Dual Op-Amp DIP-8", custSource: "Mouser", custStock: 24000, custLead: "Stock", quoteDate: "2026-06-10", notes: "", currency: "USD" },
  { line: 3, bomMpn: "TPS54331DR", quoteMpn: "TPS54331DR", match: "Exact Match", mfr: "Texas Instruments", supplier: "Huaqiang HK", custUnit: 2.18, chinaUnit: 1.62, requiredQty: 1000, availableQty: 8400, moq: 250, leadTime: "16w", validUntil: "2026-08-15", altPn: "—", risk: "Medium", decision: "Use China Price", desc: "Buck Converter 3A SOIC-8", custSource: "Avnet", custStock: 320, custLead: "26w", quoteDate: "2026-06-10", notes: "Long supplier lead", currency: "USD" },
  { line: 4, bomMpn: "XC7A35T-1FTG256C", quoteMpn: "XC7A35T-1FTG256C", match: "Partial Match", mfr: "Xilinx / AMD", supplier: "Huaqiang HK", custUnit: 68.50, chinaUnit: 62.40, requiredQty: 1000, availableQty: 320, moq: 1, leadTime: "26w", validUntil: "2026-09-01", altPn: "—", risk: "High", decision: "Request Approval", desc: "FPGA Artix-7 FTBGA-256", custSource: "Avnet", custStock: 48, custLead: "52w", quoteDate: "2026-06-09", notes: "Allocation — verify lot", currency: "USD" },
  { line: 5, bomMpn: "ADXL345BCCZ", quoteMpn: "ADXL345BCCZ", match: "Exact Match", mfr: "Analog Devices", supplier: "LCSC", custUnit: 4.85, chinaUnit: 3.12, requiredQty: 1000, availableQty: 8200, moq: 1, leadTime: "8w", validUntil: "2026-08-20", altPn: "—", risk: "Low", decision: "Use China Price", desc: "Accelerometer 3-axis LGA-14", custSource: "Digi-Key", custStock: 5200, custLead: "Stock", quoteDate: "2026-06-10", notes: "", currency: "USD" },
  { line: 6, bomMpn: "MAX232CPE", quoteMpn: "MAX232CPE+", match: "Alternative Suggested", mfr: "Maxim Integrated", supplier: "Shenzhen ECP", custUnit: 1.95, chinaUnit: 0.78, requiredQty: 1000, availableQty: 2400, moq: 100, leadTime: "16w", validUntil: "2026-08-15", altPn: "MAX3232CPE", risk: "High", decision: "Check Alternative", desc: "RS-232 Driver DIP-16 · NRND", custSource: "Mouser", custStock: 2400, custLead: "16w", quoteDate: "2026-06-08", notes: "Original NRND — alt offered", currency: "USD" },
  { line: 7, bomMpn: "BC547B", quoteMpn: "BC547B", match: "Exact Match", mfr: "ON Semiconductor", supplier: "LCSC", custUnit: 0.08, chinaUnit: 0.03, requiredQty: 4000, availableQty: 100000, moq: 1000, leadTime: "2w", validUntil: "2026-09-01", altPn: "—", risk: "Low", decision: "Use China Price", desc: "NPN BJT 45V 100mA TO-92", custSource: "Mouser", custStock: 60000, custLead: "Stock", quoteDate: "2026-06-10", notes: "", currency: "USD" },
  { line: 8, bomMpn: "PIC16F877A", quoteMpn: "PIC16F877A-I/P", match: "Partial Match", mfr: "Microchip", supplier: "Huaqiang HK", custUnit: 5.60, chinaUnit: 3.85, requiredQty: 1000, availableQty: 1800, moq: 100, leadTime: "14w", validUntil: "2026-08-30", altPn: "—", risk: "Medium", decision: "Request Approval", desc: "8-bit MCU PDIP-40", custSource: "Future", custStock: 1200, custLead: "14w", quoteDate: "2026-06-09", notes: "Suffix variant — verify", currency: "USD" },
  { line: 9, bomMpn: "AD7920ARTZ", quoteMpn: "—", match: "Not Matched", mfr: "Analog Devices", supplier: "—", custUnit: 3.40, chinaUnit: null, requiredQty: 2000, availableQty: 0, moq: 0, leadTime: "—", validUntil: "—", altPn: "—", risk: "Critical", decision: "Request Requote", desc: "12-bit SAR ADC SOT-23-6", custSource: "Digi-Key", custStock: 0, custLead: "40w", quoteDate: "—", notes: "Out of stock globally", currency: "—" },
  { line: 10, bomMpn: "LT1086CT-5", quoteMpn: "LT1086CT-5", match: "Needs Review", mfr: "Analog Devices", supplier: "Shenzhen ECP", custUnit: 1.80, chinaUnit: 0.45, requiredQty: 1000, availableQty: 4200, moq: 100, leadTime: "12w", validUntil: "2026-07-30", altPn: "—", risk: "High", decision: "Request Requote", desc: "5V LDO TO-220 · price suspiciously low", custSource: "Mouser", custStock: 850, custLead: "18w", quoteDate: "2026-06-07", notes: "Price anomaly — verify authenticity", currency: "USD" },
  { line: 11, bomMpn: "GRM188R71H104KA93D", quoteMpn: "GRM188R71H104KA93D", match: "Exact Match", mfr: "Murata", supplier: "LCSC", custUnit: 0.05, chinaUnit: 0.018, requiredQty: 24000, availableQty: 500000, moq: 4000, leadTime: "3w", validUntil: "2026-09-15", altPn: "—", risk: "Low", decision: "Use China Price", desc: "Cap Ceramic 100nF 50V X7R 0603", custSource: "Mouser", custStock: 250000, custLead: "Stock", quoteDate: "2026-06-10", notes: "", currency: "USD" },
  { line: 12, bomMpn: "RC0603FR-0710KL", quoteMpn: "RC0603FR-0710KL", match: "Exact Match", mfr: "Yageo", supplier: "LCSC", custUnit: 0.012, chinaUnit: 0.004, requiredQty: 12000, availableQty: 800000, moq: 5000, leadTime: "3w", validUntil: "2026-09-15", altPn: "—", risk: "Low", decision: "Use China Price", desc: "Resistor 10k 1% 0603", custSource: "Mouser", custStock: 500000, custLead: "Stock", quoteDate: "2026-06-10", notes: "", currency: "USD" },
];

function ChinaQuotePage() {
  const [uploaded, setUploaded] = useState(true);
  const [imported, setImported] = useState(false);
  const [openRow, setOpenRow] = useState<Row | null>(null);

  return (
    <AppLayout>
      <PageHeader
        title="מחירון סין"
        subtitle="טעינת קובץ מחירים מהקניין בסין, התאמה לשורות BOM והשוואה מול מחיר הלקוח."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              <Filter className="h-3.5 w-3.5 ml-1" /> הצג רק חיסכון גבוה
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              <Filter className="h-3.5 w-3.5 ml-1" /> הצג רק Needs Review
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              <Calculator className="h-3.5 w-3.5 ml-1" /> חשב עלות פנימית מחדש
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              <FileDown className="h-3.5 w-3.5 ml-1" /> ייצוא דוח רכש פנימי
            </Button>
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setImported(true)} style={{ background: "var(--gradient-brand)" }}>
              <Upload className="h-3.5 w-3.5 ml-1" /> ייבוא מחירון סין
            </Button>
          </div>
        }
      />

      {/* Internal warning */}
      <Alert className="mb-3 py-1.5 border-amber-400/70 bg-amber-50/70 text-amber-900">
        <Lock className="h-3.5 w-3.5" />
        <AlertDescription className="text-xs flex flex-wrap items-center gap-2">
          <span className="font-semibold">מחירי סין הם מידע פנימי של GlinTech ואינם מיועדים להצגה ללקוח.</span>
          <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-amber-100 text-amber-800 border-amber-400">
            <ShieldAlert className="h-2.5 w-2.5 ml-0.5" /> GLINTECH INTERNAL ONLY
          </Badge>
        </AlertDescription>
      </Alert>

      {/* Project context bar */}
      <Card className="mb-3 py-0 overflow-hidden">
        <div className="h-0.5" style={{ background: "var(--gradient-brand)" }} />
        <CardContent className="px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <InfoInline label="Customer" value="Elbit Systems" />
          <InfoInline label="Project" value="Radar Control Board v3" />
          <InfoInline label="Active BOM" value={<span className="font-mono">v4.3</span>} />
          <InfoInline label="BOM Type" value="PCB / SMT Assembly BOM" />
          <InfoInline label="Pricing Snapshot" value="Online Only" />
          <InfoInline label="Build Qty" value={<span className="font-mono">1,000</span>} />
        </CardContent>
      </Card>

      {/* Upload + Column mapping */}
      <div className="grid grid-cols-12 gap-3 mb-3">
        <Card className="col-span-12 xl:col-span-5 py-0">
          <CardHeader className="px-3 pt-2.5 pb-1">
            <CardTitle className="text-[13px] flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-brand text-brand-foreground text-[10px] font-bold">1</span>
              העלאת קובץ מחירון סין
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2.5">
            {!uploaded ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="mt-2 font-medium text-sm">גרור קובץ Excel / CSV של China Buyer Quote</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">.xlsx · .csv · עד 20MB</p>
                <Button className="mt-3 h-7 text-xs" variant="outline" onClick={() => setUploaded(true)}>
                  בחר קובץ מחירון סין
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
                <div className="h-9 w-9 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">China_Quote_Huaqiang_2026-06-10.xlsx</div>
                  <div className="text-[11px] text-muted-foreground">
                    318 KB · הועלה 15/06/2026 10:14 · 172 שורות · מקור: Huaqiang HK
                  </div>
                </div>
                <Badge variant="outline" className="h-5 text-[10px] bg-risk-low/20 text-risk-low border-risk-low/40">
                  <CheckCircle2 className="h-3 w-3 ml-1" /> נטען
                </Badge>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setUploaded(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Field label="Quote Source">
                <Select defaultValue="huaqiang">
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="huaqiang">Huaqiang HK</SelectItem>
                    <SelectItem value="lcsc">LCSC</SelectItem>
                    <SelectItem value="shenzhen">Shenzhen ECP</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Quote Currency">
                <Select defaultValue="usd">
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="cny">CNY</SelectItem>
                    <SelectItem value="eur">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 xl:col-span-7 py-0">
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
                          <span className="text-[9px] text-muted-foreground uppercase">recommended</span>
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
      </div>

      {/* Matching KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2 mb-3">
        <Kpi label="Quote Lines Detected" value="172" />
        <Kpi label="Matched BOM Lines" value="154" tone="good" />
        <Kpi label="Not Matched" value="18" tone="bad" />
        <Kpi label="Alternative PN" value="7" tone="warn" />
        <Kpi label="Better than Customer" value="121" tone="good" />
        <Kpi label="Stock Available" value="138" tone="good" />
        <Kpi label="MOQ Issues" value="9" tone="warn" />
        <Kpi label="Lead Time Issues" value="6" tone="warn" />
        <Kpi label="Est. Internal Cost" value="$82,300" />
        <Kpi label="Est. Savings" value="$42,500" tone="good" />
      </div>

      {/* Matching Results */}
      <Card className="mb-3 py-0">
        <CardHeader className="px-3 pt-2.5 pb-1.5 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[13px] flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-brand text-brand-foreground text-[10px] font-bold">3</span>
            תוצאות התאמה — China Quote ↔ Active BOM
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">לחץ על שורה לפתיחת חלונית החלטה</span>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right tabular-nums">Line</TableHead>
                <TableHead className="text-right">BOM MPN</TableHead>
                <TableHead className="text-right">China Quote MPN</TableHead>
                <TableHead className="text-right">Match</TableHead>
                <TableHead className="text-right">Manufacturer</TableHead>
                <TableHead className="text-right">Supplier</TableHead>
                <TableHead className="text-right tabular-nums">Cust $</TableHead>
                <TableHead className="text-right tabular-nums">China $</TableHead>
                <TableHead className="text-right tabular-nums">Saving</TableHead>
                <TableHead className="text-right tabular-nums">Req Qty</TableHead>
                <TableHead className="text-right tabular-nums">Avail</TableHead>
                <TableHead className="text-right tabular-nums">MOQ</TableHead>
                <TableHead className="text-right">Lead</TableHead>
                <TableHead className="text-right">Valid Until</TableHead>
                <TableHead className="text-right">Alt PN</TableHead>
                <TableHead className="text-right">Risk</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const savingUnit = r.chinaUnit != null ? r.custUnit - r.chinaUnit : null;
                const savingTotal = savingUnit != null ? savingUnit * r.requiredQty : null;
                return (
                  <TableRow
                    key={r.line}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setOpenRow(r)}
                  >
                    <TableCell className="text-right tabular-nums text-[11px]">{r.line}</TableCell>
                    <TableCell className="font-mono text-[11px]">{r.bomMpn}</TableCell>
                    <TableCell className="font-mono text-[11px]">{r.quoteMpn}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`h-4 px-1.5 text-[10px] ${matchCls[r.match]}`}>{r.match}</Badge>
                    </TableCell>
                    <TableCell className="text-[11px]">{r.mfr}</TableCell>
                    <TableCell className="text-[11px]">{r.supplier}</TableCell>
                    <TableCell className="text-right tabular-nums text-[11px]">${r.custUnit.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums text-[11px]">{r.chinaUnit != null ? `$${r.chinaUnit.toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-[11px]">
                      {savingTotal != null ? (
                        <span className={savingTotal >= 0 ? "text-risk-low font-semibold" : "text-risk-critical"}>
                          ${savingTotal.toFixed(0)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[11px]">{r.requiredQty.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums text-[11px]">
                      {r.availableQty > 0 ? r.availableQty.toLocaleString() : <span className="text-risk-critical">0</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[11px]">{r.moq || "—"}</TableCell>
                    <TableCell className="text-[11px]">{r.leadTime}</TableCell>
                    <TableCell className="text-[11px]">{r.validUntil}</TableCell>
                    <TableCell className="font-mono text-[11px]">{r.altPn}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`h-4 px-1.5 text-[10px] ${riskCls[r.risk]}`}>{r.risk}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select defaultValue={r.decision}>
                        <SelectTrigger className="h-6 text-[10px] w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Use China Price">Use China Price</SelectItem>
                          <SelectItem value="Keep Customer Source">Keep Customer Source</SelectItem>
                          <SelectItem value="Request Approval">Request Approval</SelectItem>
                          <SelectItem value="Request Requote">Request Requote</SelectItem>
                          <SelectItem value="Check Alternative">Check Alternative</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Success / snapshot state */}
      {imported && (
        <Card className="mb-3 border-emerald-300 bg-emerald-50/40 py-0">
          <CardContent className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-emerald-800">Pricing Snapshot עודכן בהצלחה</div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <SuccessItem label="Snapshot" value={<span className="font-semibold">With China Quote</span>} />
                  <SuccessItem label="Internal Cost" value={<span className="font-mono font-semibold">$82,300</span>} />
                  <SuccessItem label="Estimated Savings" value={<span className="text-risk-low font-semibold">$42,500</span>} />
                  <SuccessItem label="Lines Updated w/ China" value="121" />
                  <SuccessItem label="Lines Requiring Approval" value={<span className="text-amber-700 font-semibold">14</span>} />
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setImported(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer note */}
      <Alert className="py-2 border-brand/30 bg-brand/5">
        <Info className="h-3.5 w-3.5 text-brand" />
        <AlertDescription className="text-xs text-foreground">
          <span className="font-semibold">ההחלטה הסופית פר שורה</span> משפיעה על Internal Cost, Estimated Savings ועל Supplier Strategy של הפרויקט. כל החלטה דורשת אישור Procurement ויכולה לחזור ל-Customer Quote רק דרך Pricing Snapshot חדש.
        </AlertDescription>
      </Alert>

      {/* Decision Drawer */}
      <Sheet open={!!openRow} onOpenChange={(v) => !v && setOpenRow(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto">
          {openRow && (() => {
            const r = openRow;
            const savingUnit = r.chinaUnit != null ? r.custUnit - r.chinaUnit : 0;
            const savingTotal = savingUnit * r.requiredQty;
            const coverage = r.requiredQty > 0 ? Math.min(100, Math.round((r.availableQty / r.requiredQty) * 100)) : 0;
            const moqIssue = r.moq > r.requiredQty;
            return (
              <>
                <SheetHeader className="space-y-1 text-right">
                  <SheetTitle className="text-base flex items-center gap-2 flex-wrap">
                    <span className="font-mono">{r.bomMpn}</span>
                    <Badge variant="outline" className={`h-4 px-1.5 text-[10px] ${matchCls[r.match]}`}>{r.match}</Badge>
                    <Badge variant="outline" className={`h-4 px-1.5 text-[10px] ${riskCls[r.risk]}`}>{r.risk}</Badge>
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    {r.desc} · BOM Line {r.line}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-3 space-y-3 px-4 pb-4">
                  <DrawerSection title="BOM Line">
                    <KV k="Original MPN" v={<span className="font-mono">{r.bomMpn}</span>} />
                    <KV k="Matched MPN" v={<span className="font-mono">{r.quoteMpn}</span>} />
                    <KV k="Manufacturer" v={r.mfr} />
                    <KV k="Required Qty" v={r.requiredQty.toLocaleString()} />
                    <KV k="Description" v={r.desc} wide />
                  </DrawerSection>

                  <DrawerSection title="Customer Price Source" tone="customer">
                    <KV k="Source Type" v={r.custSource} />
                    <KV k="Customer Unit Price" v={`$${r.custUnit.toFixed(2)}`} />
                    <KV k="Stock" v={r.custStock.toLocaleString()} />
                    <KV k="Lead Time" v={r.custLead} />
                  </DrawerSection>

                  <DrawerSection title="China Buyer Quote" tone="internal">
                    <KV k="Supplier" v={r.supplier} />
                    <KV k="China Unit Price" v={r.chinaUnit != null ? `$${r.chinaUnit.toFixed(2)}` : "—"} />
                    <KV k="Currency" v={r.currency} />
                    <KV k="MOQ" v={r.moq.toLocaleString()} />
                    <KV k="Available Qty" v={r.availableQty.toLocaleString()} />
                    <KV k="Lead Time" v={r.leadTime} />
                    <KV k="Quote Date" v={r.quoteDate} />
                    <KV k="Valid Until" v={r.validUntil} />
                    <KV k="Notes" v={r.notes || "—"} wide />
                  </DrawerSection>

                  <DrawerSection title="Decision Analysis">
                    <KV k="Saving per Unit" v={r.chinaUnit != null ? <span className="text-risk-low font-semibold">${savingUnit.toFixed(2)}</span> : "—"} />
                    <KV k="Total Saving" v={r.chinaUnit != null ? <span className="text-risk-low font-semibold">${savingTotal.toFixed(0)}</span> : "—"} />
                    <KV k="Stock Coverage" v={`${coverage}%`} />
                    <KV k="MOQ Impact" v={moqIssue ? <span className="text-amber-700">חורג מהצורך</span> : "תקין"} />
                    <KV k="Lead Time Impact" v={r.leadTime} />
                    <KV k="Match Confidence" v={r.match === "Exact Match" ? "99%" : r.match === "Partial Match" ? "82%" : "—"} />
                    <KV k="Risk Reason" v={r.notes || "—"} wide />
                  </DrawerSection>

                  <DrawerSection title="Recommended Action">
                    <div className="grid grid-cols-1 gap-1.5">
                      <ActionBtn icon={<ArrowLeftRight className="h-3.5 w-3.5" />} primary={r.decision === "Use China Price"}>Use China Price</ActionBtn>
                      <ActionBtn icon={<ShieldAlert className="h-3.5 w-3.5" />} primary={r.decision === "Request Approval"}>Request Approval</ActionBtn>
                      <ActionBtn icon={<FileSpreadsheet className="h-3.5 w-3.5" />} primary={r.decision === "Request Requote"}>Request Requote</ActionBtn>
                      <ActionBtn icon={<Lock className="h-3.5 w-3.5" />} primary={r.decision === "Keep Customer Source"}>Keep Authorized Source</ActionBtn>
                      <ActionBtn icon={<Sparkles className="h-3.5 w-3.5" />} primary={r.decision === "Check Alternative"}>Ask Engineering to Approve Alternative</ActionBtn>
                    </div>
                  </DrawerSection>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

function InfoInline({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
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

function DrawerSection({
  title, children, tone,
}: { title: string; children: React.ReactNode; tone?: "customer" | "internal" }) {
  const toneCls =
    tone === "customer" ? "border-emerald-200 bg-emerald-50/40" :
    tone === "internal" ? "border-amber-200 bg-amber-50/40" :
    "border-border bg-muted/30";
  return (
    <div className={`rounded-md border ${toneCls} px-3 py-2`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {title}
        {tone === "internal" && <Badge variant="outline" className="h-3.5 px-1 text-[8px] bg-amber-100 text-amber-800 border-amber-400">INTERNAL</Badge>}
        {tone === "customer" && <Badge variant="outline" className="h-3.5 px-1 text-[8px] bg-emerald-100 text-emerald-800 border-emerald-300">CUSTOMER</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {children}
      </div>
    </div>
  );
}

function KV({ k, v, wide }: { k: string; v: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <div className="text-[10px] text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}

function ActionBtn({ children, icon, primary }: { children: React.ReactNode; icon: React.ReactNode; primary?: boolean }) {
  return (
    <Button
      size="sm"
      variant={primary ? "default" : "outline"}
      className="h-7 text-xs justify-start"
      style={primary ? { background: "var(--gradient-brand)" } : undefined}
    >
      <span className="ml-1.5">{icon}</span> {children}
    </Button>
  );
}
