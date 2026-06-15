import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bomLines } from "@/lib/mock-data";
import glintechLogo from "@/assets/glintech-logo.png.asset.json";
import {
  FileSpreadsheet, FileText, Cloud, ShieldCheck, ShieldAlert, Lock,
  Eye, Save, ArrowUp, ArrowDown, FolderOpen, Download, Copy, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/export")({
  component: ExportBuilder,
});

type ExportType = "cust-xlsx" | "cust-pdf" | "int-xlsx" | "int-pdf";
type Audience = "customer" | "internal";
type Format = "excel" | "pdf";

const audienceOf = (t: ExportType): Audience => (t.startsWith("cust") ? "customer" : "internal");
const formatOf = (t: ExportType): Format => (t.endsWith("pdf") ? "pdf" : "excel");

// Field catalog grouped — each field has an audience scope.
type Field = { id: string; label: string; group: string; internal?: boolean };
const FIELDS: Field[] = [
  // BOM Identity
  { id: "line", label: "Line", group: "BOM Identity" },
  { id: "origMpn", label: "Original MPN", group: "BOM Identity", internal: true },
  { id: "cleanMpn", label: "Cleaned MPN", group: "BOM Identity", internal: true },
  { id: "mpn", label: "MPN / Matched MPN", group: "BOM Identity" },
  { id: "mfr", label: "Manufacturer", group: "BOM Identity" },
  { id: "origDesc", label: "Original Description", group: "BOM Identity", internal: true },
  { id: "normDesc", label: "Normalized Description", group: "BOM Identity" },
  { id: "descUpdated", label: "Description Updated", group: "BOM Identity", internal: true },
  { id: "confidence", label: "Match Confidence", group: "BOM Identity", internal: true },
  { id: "qty", label: "Qty per Assembly", group: "BOM Identity" },
  { id: "reqQty", label: "Required Qty", group: "BOM Identity" },
  // Pricing — customer
  { id: "custUnit", label: "Customer Unit Price", group: "Pricing" },
  { id: "custTotal", label: "Customer Total Price", group: "Pricing" },
  { id: "pricingSource", label: "Pricing Source Type", group: "Pricing" },
  // Pricing — internal
  { id: "intUnit", label: "Internal Unit Cost", group: "Internal Data", internal: true },
  { id: "intTotal", label: "Internal Total Cost", group: "Internal Data", internal: true },
  { id: "chinaPrice", label: "China Buyer Price", group: "Supplier Offers", internal: true },
  { id: "chinaSupplier", label: "China Supplier", group: "Supplier Offers", internal: true },
  { id: "repPrice", label: "Official Rep Price", group: "Supplier Offers", internal: true },
  { id: "intSource", label: "Internal Recommended Source", group: "Internal Data", internal: true },
  { id: "grossDelta", label: "Gross Delta", group: "Internal Data", internal: true },
  { id: "grossMargin", label: "Gross Margin", group: "Internal Data", internal: true },
  { id: "savings", label: "Savings", group: "Internal Data", internal: true },
  { id: "approval", label: "Approval Required", group: "Internal Data", internal: true },
  // Availability
  { id: "stock", label: "Available Qty / Stock Status", group: "Availability" },
  { id: "moq", label: "MOQ", group: "Availability" },
  { id: "leadTime", label: "Lead Time", group: "Availability" },
  { id: "availability", label: "Availability Status", group: "Availability" },
  { id: "lifecycle", label: "Lifecycle Status", group: "Availability" },
  // Risk
  { id: "risk", label: "Risk Level", group: "Risk" },
  { id: "decision", label: "Decision Reason", group: "Risk", internal: true },
  // Notes
  { id: "custNotes", label: "Customer Notes", group: "Notes" },
  { id: "intNotes", label: "Internal Notes", group: "Notes", internal: true },
  { id: "buyerNotes", label: "Buyer Notes", group: "Notes", internal: true },
];

const DEFAULT_CUST = ["line","mpn","mfr","normDesc","qty","reqQty","custUnit","custTotal","pricingSource","availability","stock","leadTime","lifecycle","risk","custNotes"];
const DEFAULT_INT = ["line","origMpn","cleanMpn","mpn","mfr","normDesc","descUpdated","confidence","qty","custUnit","custTotal","intUnit","intTotal","chinaPrice","chinaSupplier","repPrice","moq","stock","leadTime","intSource","grossDelta","grossMargin","risk","decision","intNotes","buyerNotes","approval"];

const CUSTOMER_PDF_SECTIONS = ["Cover Page","Project Details","Pricing Assumptions","BOM Cost Summary","Availability & Risk Summary","Long Lead Items","EOL / Obsolete Items","BOM Table","Notes & Disclaimers"];
const INTERNAL_PDF_SECTIONS = ["Cover Page — GLINTECH INTERNAL ONLY","Executive Summary","Customer Price vs Internal Cost","Gross Delta / Margin","Supplier Strategy","Critical Risks","BOM Quality","Top Savings Opportunities","Top Risk Items","Recommended Actions"];

const exportHistory = [
  { date: "15/06/2026 14:22", type: "Customer Excel", format: "XLSX", file: "ELB-RCB-003_v4.3_Customer.xlsx", by: "M. Cohen", ver: "v4.3", snap: "With China Quote", safe: true, folder: "05_Customer_Exports" },
  { date: "15/06/2026 11:08", type: "Internal PDF", format: "PDF", file: "ELB-RCB-003_v4.3_Internal_Mgmt.pdf", by: "M. Cohen", ver: "v4.3", snap: "With China Quote", safe: false, folder: "06_Internal_Reports" },
  { date: "14/06/2026 17:45", type: "Internal Excel", format: "XLSX", file: "ELB-RCB-003_v4.3_Procurement.xlsx", by: "Y. Levi", ver: "v4.3", snap: "With China Quote", safe: false, folder: "06_Internal_Reports" },
  { date: "12/06/2026 09:30", type: "Customer PDF", format: "PDF", file: "ELB-RCB-003_v4.2_Customer.pdf", by: "M. Cohen", ver: "v4.2", snap: "Baseline", safe: true, folder: "05_Customer_Exports" },
  { date: "08/06/2026 16:12", type: "Customer Excel", format: "XLSX", file: "ELB-RCB-003_v4.1_Customer.xlsx", by: "M. Cohen", ver: "v4.1", snap: "Baseline", safe: true, folder: "05_Customer_Exports" },
];

function ExportCard({ active, onClick, title, desc, safe, format }: { active: boolean; onClick: () => void; title: string; desc: string; safe: boolean; format: Format }) {
  const Icon = format === "excel" ? FileSpreadsheet : FileText;
  return (
    <button
      onClick={onClick}
      className={`text-right p-3 rounded-lg border transition-all ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 hover:border-border bg-card"}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <Icon className={`h-5 w-5 ${format === "excel" ? "text-emerald-600" : "text-red-600"}`} />
        <Badge
          variant="outline"
          className={`text-[9px] px-1.5 py-0 ${safe ? "border-risk-low/40 text-risk-low bg-risk-low/10" : "border-risk-critical/40 text-risk-critical bg-risk-critical/10"}`}
        >
          {safe ? "CUSTOMER SAFE" : "GLINTECH INTERNAL ONLY"}
        </Badge>
      </div>
      <div className="font-semibold text-sm leading-tight mb-1">{title}</div>
      <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>
    </button>
  );
}

function ExportBuilder() {
  const [exportType, setExportType] = useState<ExportType>("cust-xlsx");
  const audience = audienceOf(exportType);
  const format = formatOf(exportType);

  const [selected, setSelected] = useState<string[]>(DEFAULT_CUST);
  const [lang, setLang] = useState("he");
  const [currency, setCurrency] = useState("USD");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [saveDrive, setSaveDrive] = useState(true);
  const [folder, setFolder] = useState("05_Customer_Exports");

  const switchType = (t: ExportType) => {
    setExportType(t);
    const a = audienceOf(t);
    setSelected(a === "customer" ? DEFAULT_CUST : DEFAULT_INT);
    setFolder(a === "customer" ? "05_Customer_Exports" : "06_Internal_Reports");
  };

  const available = useMemo(() => FIELDS.filter(f => !selected.includes(f.id)), [selected]);
  const selectedFields = useMemo(() => selected.map(id => FIELDS.find(f => f.id === id)!).filter(Boolean), [selected]);

  const groups = useMemo(() => {
    const g: Record<string, Field[]> = {};
    for (const f of available) {
      (g[f.group] ||= []).push(f);
    }
    return g;
  }, [available]);

  const toggleField = (id: string) => {
    const f = FIELDS.find(x => x.id === id)!;
    if (audience === "customer" && f.internal) return;
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };
  const move = (i: number, dir: -1 | 1) => {
    setSelected(s => {
      const n = [...s];
      const j = i + dir;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };

  const renderCell = (l: typeof bomLines[number], id: string) => {
    switch (id) {
      case "line": return l.line;
      case "origMpn": return <span className="font-mono text-xs">{l.originalMpn}</span>;
      case "cleanMpn": return <span className="font-mono text-xs">{l.cleanedMpn}</span>;
      case "mpn": return <span className="font-mono text-xs">{l.matchedMpn}</span>;
      case "mfr": return l.manufacturer;
      case "origDesc": return <span className="text-xs truncate block max-w-[180px]">{l.originalDesc}</span>;
      case "normDesc": return <span className="text-xs truncate block max-w-[200px]">{l.normalizedDesc}</span>;
      case "descUpdated": return l.descUpdated ? "Yes" : "No";
      case "confidence": return `${l.confidence}%`;
      case "qty": return l.qty;
      case "reqQty": return l.requiredQty;
      case "custUnit": return `$${l.custUnit.toFixed(2)}`;
      case "custTotal": return `$${l.custTotal.toFixed(0)}`;
      case "pricingSource": return l.custSource;
      case "intUnit": return `$${l.intUnit.toFixed(2)}`;
      case "intTotal": return `$${l.intTotal.toFixed(0)}`;
      case "chinaPrice": return `$${(l.intUnit * 0.95).toFixed(2)}`;
      case "chinaSupplier": return l.intSource === "China Buyer" ? "Shenzhen Huaqiang" : "—";
      case "repPrice": return `$${(l.custUnit * 0.88).toFixed(2)}`;
      case "intSource": return l.intSource;
      case "grossDelta": return <span className="text-risk-low">+${(l.custTotal - l.intTotal).toFixed(0)}</span>;
      case "grossMargin": return <span className="text-risk-low">{(((l.custTotal - l.intTotal) / l.custTotal) * 100).toFixed(1)}%</span>;
      case "savings": return `$${(l.custTotal - l.intTotal).toFixed(0)}`;
      case "approval": return l.needsReview ? "Yes" : "No";
      case "stock": return l.stock.toLocaleString();
      case "moq": return l.moq;
      case "leadTime": return l.leadTime;
      case "availability": return l.stock > 0 ? "In Stock" : "Out of Stock";
      case "lifecycle": return l.lifecycle;
      case "risk": return l.risk;
      case "decision": return l.notes || "Use authorized source";
      case "custNotes": return <span className="text-xs">{l.notes}</span>;
      case "intNotes": return <span className="text-xs">{l.notes}</span>;
      case "buyerNotes": return <span className="text-xs">—</span>;
      default: return "";
    }
  };

  const pdfSections = audience === "customer" ? CUSTOMER_PDF_SECTIONS : INTERNAL_PDF_SECTIONS;

  return (
    <AppLayout>
      <PageHeader
        title="דוחות וייצוא"
        subtitle="הפקת דוחות Excel/PDF ללקוח או לתיעוד פנימי של גלינטק, לפי שדות ותבניות מוגדרות."
        actions={
          <>
            <Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5 ml-1" /> תצוגה מקדימה</Button>
            <Button variant="outline" size="sm"><Save className="h-3.5 w-3.5 ml-1" /> שמור תבנית יצוא</Button>
          </>
        }
      />

      {/* Project context bar */}
      <Card className="mb-3 border-border/60">
        <CardContent className="p-2.5 flex items-center gap-2 flex-wrap text-[11px]">
          <Badge variant="outline" className="text-[10px]">Customer: <b className="mr-1">Elbit Systems</b></Badge>
          <Badge variant="outline" className="text-[10px]">Project: <b className="mr-1">Radar Control Board v3</b></Badge>
          <Badge variant="outline" className="text-[10px]">Code: <b className="mr-1">ELB-RCB-003</b></Badge>
          <Badge variant="outline" className="text-[10px]">BOM Version: <b className="mr-1">v4.3</b></Badge>
          <Badge variant="outline" className="text-[10px]">Pricing Snapshot: <b className="mr-1">With China Quote</b></Badge>
          <Badge variant="outline" className="text-[10px]">BOM Type: <b className="mr-1">PCB / SMT Assembly</b></Badge>
          <Badge variant="outline" className="text-[10px]">Build Qty: <b className="mr-1">1,000</b></Badge>
          <Badge variant="outline" className="text-[10px] mr-auto">Last Updated: <b className="mr-1">15/06/2026</b></Badge>
        </CardContent>
      </Card>

      {/* Export type cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <ExportCard active={exportType === "cust-xlsx"} onClick={() => switchType("cust-xlsx")} title="Customer Excel" desc="קובץ Excel נקי לשליחה ללקוח, ללא מחירי רכש פנימיים." safe format="excel" />
        <ExportCard active={exportType === "cust-pdf"} onClick={() => switchType("cust-pdf")} title="Customer PDF" desc="דוח PDF מסכם ללקוח עם מחיר, זמינות וסיכונים רלוונטיים." safe format="pdf" />
        <ExportCard active={exportType === "int-xlsx"} onClick={() => switchType("int-xlsx")} title="Internal Excel" desc="קובץ פנימי מלא הכולל מחירי סין, ספקים, עלות פנימית ומרווחים." safe={false} format="excel" />
        <ExportCard active={exportType === "int-pdf"} onClick={() => switchType("int-pdf")} title="Internal PDF" desc="דוח הנהלה פנימי עם עלויות, רווחיות, סיכונים והמלצות רכש." safe={false} format="pdf" />
      </div>

      {/* Audience banner */}
      {audience === "customer" ? (
        <div className="mb-3 flex items-center gap-2 p-2 rounded border border-risk-low/40 bg-risk-low/10 text-xs">
          <ShieldCheck className="h-4 w-4 text-risk-low shrink-0" />
          <div className="flex-1">
            <b className="text-risk-low">Customer Safe Validation: Passed</b>
            <span className="text-muted-foreground mr-2">— הדוח נקי ממחירי רכש פנימיים, ספקי סין, מרווחים והערות פנימיות.</span>
          </div>
          <Badge className="bg-risk-low/15 text-risk-low border-risk-low/40 text-[10px]" variant="outline">CUSTOMER SAFE</Badge>
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-2 p-2 rounded border border-risk-critical/40 bg-risk-critical/10 text-xs">
          <ShieldAlert className="h-4 w-4 text-risk-critical shrink-0" />
          <div className="flex-1 text-risk-critical font-semibold">
            GLINTECH INTERNAL ONLY — דוח זה כולל מידע מסחרי פנימי ואינו מיועד לשליחה ללקוח.
          </div>
          <Badge className="bg-risk-critical/15 text-risk-critical border-risk-critical/40 text-[10px]" variant="outline">INTERNAL ONLY</Badge>
        </div>
      )}

      {/* Field selector + Settings/PDF panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 mb-3">
        {/* Available */}
        <Card className="xl:col-span-5">
          <CardHeader className="py-2 px-3"><CardTitle className="text-sm">Available Fields</CardTitle></CardHeader>
          <CardContent className="p-2 max-h-[360px] overflow-auto space-y-2">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">{group}</div>
                <div className="grid grid-cols-1 gap-0.5">
                  {items.map(f => {
                    const locked = audience === "customer" && f.internal;
                    return (
                      <label key={f.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${locked ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50 cursor-pointer"}`}>
                        <Checkbox disabled={locked} checked={false} onCheckedChange={() => toggleField(f.id)} />
                        <span className="flex-1">{f.label}</span>
                        {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        {f.internal && !locked && <Badge variant="outline" className="text-[9px] py-0 px-1 border-risk-critical/40 text-risk-critical">INT</Badge>}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Selected */}
        <Card className="xl:col-span-4">
          <CardHeader className="py-2 px-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Selected Fields ({selectedFields.length})</CardTitle>
            <Badge variant="outline" className="text-[10px]">סדר הופעה בקובץ</Badge>
          </CardHeader>
          <CardContent className="p-2 max-h-[360px] overflow-auto space-y-0.5">
            {selectedFields.map((f, i) => (
              <div key={f.id} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/50 text-xs">
                <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                <span className="flex-1">{f.label}</span>
                {f.internal && <Badge variant="outline" className="text-[9px] py-0 px-1 border-risk-critical/40 text-risk-critical">INT</Badge>}
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-5 w-5 text-risk-critical" onClick={() => toggleField(f.id)}>×</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Settings + PDF structure */}
        <Card className="xl:col-span-3">
          <CardHeader className="py-2 px-3"><CardTitle className="text-sm">Export Settings</CardTitle></CardHeader>
          <CardContent className="p-3 space-y-2 text-xs">
            <div>
              <div className="text-muted-foreground mb-1">File Format</div>
              <Tabs value={format} onValueChange={(v) => switchType(`${audience === "customer" ? "cust" : "int"}-${v === "pdf" ? "pdf" : "xlsx"}` as ExportType)}>
                <TabsList className="h-7 w-full">
                  <TabsTrigger value="excel" className="text-[11px] h-6 flex-1">Excel</TabsTrigger>
                  <TabsTrigger value="pdf" className="text-[11px] h-6 flex-1">PDF</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted-foreground mb-1">Language</div>
                <Select value={lang} onValueChange={setLang}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="he">עברית</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Currency</div>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="ILS">ILS</SelectItem>
                    <SelectItem value="RMB">RMB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Destination Folder</div>
              <Select value={folder} onValueChange={setFolder}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="05_Customer_Exports">05_Customer_Exports</SelectItem>
                  <SelectItem value="06_Internal_Reports">06_Internal_Reports</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={includeLogo} onCheckedChange={(v) => setIncludeLogo(!!v)} /> Include GlinTech Logo</label>
            <label className="flex items-center gap-2"><Checkbox checked disabled /> Include Timestamp</label>
            <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={saveDrive} onCheckedChange={(v) => setSaveDrive(!!v)} /> Save to Google Drive</label>
          </CardContent>
        </Card>
      </div>

      {/* Preview + PDF structure */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 mb-3">
        <Card className={format === "pdf" ? "xl:col-span-8" : "xl:col-span-12"}>
          <CardHeader className="py-2 px-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">תצוגה מקדימה — {audience === "customer" ? "Customer" : "Internal"} {format === "pdf" ? "PDF (טבלת BOM)" : "Excel"}</CardTitle>
            <Badge variant="outline" className="text-[10px]">8 שורות ראשונות · {selectedFields.length} עמודות</Badge>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            {includeLogo && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-[var(--navy)] text-white">
                <img src={glintechLogo.url} alt="GlinTech" className="object-contain" style={{ width: 200, height: 44 }} />
                <div className="text-right leading-tight">
                  <div className="text-[13px] font-semibold tracking-wide">
                    {audience === "customer" ? "Customer Report" : "GLINTECH INTERNAL ONLY"}
                  </div>
                  <div className="text-[10px] text-white/70">
                    {audience === "customer"
                      ? "Customer Safe — sanitized export"
                      : "Confidential — internal cost, China pricing & margins"}
                  </div>
                </div>
              </div>
            )}
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {selectedFields.map(f => (
                    <TableHead key={f.id} className="text-[10px] whitespace-nowrap py-1.5">{f.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {bomLines.slice(0, 8).map(l => (
                  <TableRow key={l.line}>
                    {selectedFields.map(f => (
                      <TableCell key={f.id} className="py-1 whitespace-nowrap">{renderCell(l, f.id)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {format === "pdf" && (
          <Card className="xl:col-span-4">
            <CardHeader className="py-2 px-3"><CardTitle className="text-sm">PDF Report Structure</CardTitle></CardHeader>
            <CardContent className="p-3 space-y-1">
              {pdfSections.map((s, i) => (
                <div key={s} className="flex items-center gap-2 text-xs p-1.5 rounded border border-border/40 bg-muted/30">
                  <span className="w-5 h-5 rounded bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center">{i + 1}</span>
                  <span className="flex-1">{s}</span>
                  <CheckCircle2 className="h-3 w-3 text-risk-low" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Export history */}
      <Card className="mb-3">
        <CardHeader className="py-2 px-3"><CardTitle className="text-sm">היסטוריית ייצוא</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="py-1.5">Date</TableHead>
                <TableHead>Export Type</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Exported By</TableHead>
                <TableHead>BOM Ver.</TableHead>
                <TableHead>Pricing Snapshot</TableHead>
                <TableHead>Customer Safe</TableHead>
                <TableHead>Drive Folder</TableHead>
                <TableHead className="text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exportHistory.map((h, i) => (
                <TableRow key={i}>
                  <TableCell className="py-1 whitespace-nowrap">{h.date}</TableCell>
                  <TableCell>{h.type}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{h.format}</Badge></TableCell>
                  <TableCell className="font-mono text-[11px]">{h.file}</TableCell>
                  <TableCell>{h.by}</TableCell>
                  <TableCell>{h.ver}</TableCell>
                  <TableCell>{h.snap}</TableCell>
                  <TableCell>
                    {h.safe
                      ? <Badge variant="outline" className="text-[10px] border-risk-low/40 text-risk-low bg-risk-low/10">SAFE</Badge>
                      : <Badge variant="outline" className="text-[10px] border-risk-critical/40 text-risk-critical bg-risk-critical/10">INTERNAL</Badge>}
                  </TableCell>
                  <TableCell className="text-[11px]">{h.folder}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-start">
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Open in Drive"><FolderOpen className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Download"><Download className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Duplicate Settings"><Copy className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 -mx-3 px-3 py-2 bg-background/95 backdrop-blur border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] text-muted-foreground">
          {audience === "customer"
            ? <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-risk-low" /> ייצוא ללקוח — שדות פנימיים מוסתרים אוטומטית</span>
            : <span className="flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5 text-risk-critical" /> ייצוא פנימי — כולל מחירי סין, מרווחים ועלויות רכש</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5 ml-1" /> תצוגה מקדימה</Button>
          <Button variant="outline" size="sm"><FileSpreadsheet className="h-3.5 w-3.5 ml-1" /> ייצוא Excel</Button>
          <Button variant="outline" size="sm"><FileText className="h-3.5 w-3.5 ml-1" /> ייצוא PDF</Button>
          <Button size="sm" style={{ background: "var(--gradient-brand)" }} className="text-white">
            <Cloud className="h-3.5 w-3.5 ml-1" /> שמירה ב-Google Drive
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
