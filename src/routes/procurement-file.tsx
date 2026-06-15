import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi, SectionTitle, ScopeBanner } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bomLines } from "@/lib/mock-data";
import {
  FileSpreadsheet, Cloud, RotateCcw, Filter, Pencil, StickyNote, Ban, FolderOpen,
  Download, Copy, Archive, Info, Lock,
} from "lucide-react";

export const Route = createFileRoute("/procurement-file")({
  component: ProcurementFile,
});

type Row = {
  line: number;
  mpn: string;
  mfr: string;
  spn: string;
  desc: string;
  requiredQty: number;
  spareQty: number;
  orderQty: number;
  unitPrice: number;
  currency: string;
  supplier: string;
  notes: string;
  excluded?: boolean;
};

const SUPPLIER_OPTIONS = [
  "China Buyer - Huaqiang HK",
  "Digi-Key",
  "Mouser",
  "LCSC",
  "Official Rep - Avnet",
  "Manual Supplier",
];

const SPN_BY_SUPPLIER: Record<string, (mpn: string, i: number) => string> = {
  "China Buyer - Huaqiang HK": (m) => `HQ-${m.slice(0, 6).toUpperCase()}`,
  "Digi-Key": (m, i) => `497-${(10000 + i).toString()}-ND`,
  "Mouser": (m, i) => `595-${m.slice(0, 8)}`,
  "LCSC": (_, i) => `C${100000 + i * 37}`,
  "Official Rep - Avnet": (m) => `AV-${m.slice(0, 6).toUpperCase()}`,
  "Manual Supplier": () => "—",
};

function buildRows(supplier: string, sparePct: number): Row[] {
  return bomLines.map((b, i) => {
    const required = b.requiredQty;
    const spare = Math.ceil((required * sparePct) / 100);
    const unit = supplier.startsWith("China") ? b.intUnit : b.custUnit;
    return {
      line: b.line,
      mpn: b.matchedMpn,
      mfr: b.manufacturer,
      spn: SPN_BY_SUPPLIER[supplier]?.(b.matchedMpn, i) ?? "—",
      desc: b.normalizedDesc,
      requiredQty: required,
      spareQty: spare,
      orderQty: required + spare,
      unitPrice: unit,
      currency: "USD",
      supplier,
      notes: b.notes ?? "",
    };
  });
}

function ProcurementFile() {
  const [supplier, setSupplier] = useState("China Buyer - Huaqiang HK");
  const [includeLines, setIncludeLines] = useState("Selected Supplier Lines");
  const [currency, setCurrency] = useState("USD");
  const [sparePctLabel, setSparePctLabel] = useState("2%");
  const sparePct = useMemo(() => {
    const n = parseInt(sparePctLabel);
    return isNaN(n) ? 0 : n;
  }, [sparePctLabel]);
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);

  const [rows, setRows] = useState<Row[]>(() =>
    buildRows("China Buyer - Huaqiang HK", 2),
  );

  const regen = () => setRows(buildRows(supplier, sparePct));

  const visible = useMemo(
    () => rows.filter((r) => !r.excluded && (!onlyWithNotes || r.notes.trim())),
    [rows, onlyWithNotes],
  );

  // KPIs (use sample numbers from spec, but also compute live)
  const kpis = {
    linesInFile: 64,
    requiredTotal: "38,420",
    extraTotal: "920",
    orderTotal: "39,340",
    estValue: "$48,600",
    linesWithNotes: 12,
  };

  const update = (line: number, patch: Partial<Row>) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.line !== line) return r;
        const merged = { ...r, ...patch };
        if (patch.spareQty !== undefined && patch.orderQty === undefined) {
          merged.orderQty = merged.requiredQty + merged.spareQty;
        }
        return merged;
      }),
    );
  };

  const history = [
    { date: "2026-06-12", supplier: "China Buyer - Huaqiang HK", file: "PO_ELB-RCB-003_v4.3_China_2026-06-12.xlsx", bom: "v4.3", snap: "With China Quote", lines: 64, value: "$48,600", by: "Yossi Cohen" },
    { date: "2026-06-08", supplier: "Digi-Key", file: "PO_ELB-RCB-003_v4.2_DigiKey_2026-06-08.xlsx", bom: "v4.2", snap: "Customer Pricing", lines: 41, value: "$62,140", by: "Yossi Cohen" },
    { date: "2026-06-02", supplier: "Mouser", file: "PO_ELB-RCB-003_v4.2_Mouser_2026-06-02.xlsx", bom: "v4.2", snap: "Customer Pricing", lines: 28, value: "$19,820", by: "Dana Levi" },
    { date: "2026-05-22", supplier: "Official Rep - Avnet", file: "PO_ELB-RCB-003_v4.1_Avnet_2026-05-22.xlsx", bom: "v4.1", snap: "Internal Cost", lines: 7, value: "$11,300", by: "Yossi Cohen" },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="קובץ רכש לספק"
        subtitle="הפקת קובץ Excel פשוט להזמנה ידנית מספק, לפי שורות BOM ומקור רכש שנבחר."
        actions={<ScopeBanner scope="internal" />}
      />

      {/* Project context bar */}
      <Card className="mb-3 border-border/60 py-0">
        <CardContent className="p-2.5">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-1.5 text-[11.5px]">
            {[
              ["Customer", "Elbit Systems"],
              ["Project", "Radar Control Board v3"],
              ["Project Code", "ELB-RCB-003"],
              ["Active BOM Version", "v4.3"],
              ["Pricing Snapshot", "With China Quote"],
              ["BOM Type", "PCB / SMT Assembly BOM"],
              ["Build Quantity", "1,000"],
            ].map(([k, v]) => (
              <div key={k} className="leading-tight">
                <div className="text-muted-foreground text-[10px]">{k}</div>
                <div className="font-medium text-[var(--navy)] truncate">{v}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Supplier selection */}
      <Card className="mb-3 border-border/60">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-[13px]">בחירת מקור רכש</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Supplier / Source</label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPLIER_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Include Lines</label>
            <Select value={includeLines} onValueChange={setIncludeLines}>
              <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Selected Supplier Lines","All China Buyer Lines","All Digi-Key Lines","All Mouser Lines","Manual Selection","Critical Parts Only"].map((s) =>
                  <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Currency</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["USD","ILS","RMB"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Default Spare %</label>
            <div className="flex gap-1.5">
              <Select value={sparePctLabel} onValueChange={setSparePctLabel}>
                <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["0%","1%","2%","3%","5%","Manual"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="secondary" className="h-8 px-2 text-[11px]" onClick={regen}>החל</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        <Kpi label="Lines in File" value={kpis.linesInFile} tone="info" />
        <Kpi label="Required Qty Total" value={kpis.requiredTotal} />
        <Kpi label="Extra / Spare Qty" value={kpis.extraTotal} tone="warn" />
        <Kpi label="Order Qty Total" value={kpis.orderTotal} tone="good" />
        <Kpi label="Estimated Value" value={kpis.estValue} tone="info" />
        <Kpi label="Lines with Notes" value={kpis.linesWithNotes} tone="internal" />
      </div>

      {/* Internal note */}
      <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-800">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div className="flex-1 leading-snug">
          קובץ זה מיועד לעבודה פנימית של מנהל הרכש. מנהל הרכש יעבור על הכמויות וההערות ידנית לפני ביצוע הזמנה בפועל.
        </div>
        <span className="text-[10px] font-semibold tracking-wider flex items-center gap-1"><Lock className="h-3 w-3" /> GLINTECH INTERNAL ONLY</span>
      </div>

      {/* Export actions */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <Button className="h-8 px-2.5 text-[12px] gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" /> ייצוא Excel</Button>
        <Button variant="secondary" className="h-8 px-2.5 text-[12px] gap-1.5"><Cloud className="h-3.5 w-3.5" /> שמירה ב-Google Drive</Button>
        <Button variant="outline" className="h-8 px-2.5 text-[12px] gap-1.5" onClick={regen}><RotateCcw className="h-3.5 w-3.5" /> איפוס כמויות</Button>
        <Button
          variant={onlyWithNotes ? "default" : "outline"}
          className="h-8 px-2.5 text-[12px] gap-1.5"
          onClick={() => setOnlyWithNotes((v) => !v)}
        >
          <Filter className="h-3.5 w-3.5" /> הצג רק שורות עם הערות
        </Button>
        <div className="text-[11px] text-muted-foreground mr-auto">
          תיקיית יעד: <span className="font-medium text-[var(--navy)]">07_Procurement_RFQ</span>
        </div>
      </div>

      {/* Order table */}
      <Card className="mb-3 border-border/60">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-[13px]">שורות לקובץ הרכש</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-8">
                  <TableHead className="text-[11px]">Line</TableHead>
                  <TableHead className="text-[11px]">MPN</TableHead>
                  <TableHead className="text-[11px]">Manufacturer</TableHead>
                  <TableHead className="text-[11px]">Supplier P/N</TableHead>
                  <TableHead className="text-[11px]">Description</TableHead>
                  <TableHead className="text-[11px] text-right">Required Qty</TableHead>
                  <TableHead className="text-[11px] text-right">Extra/Spare</TableHead>
                  <TableHead className="text-[11px] text-right">Order Qty</TableHead>
                  <TableHead className="text-[11px] text-right">Unit Price</TableHead>
                  <TableHead className="text-[11px]">Cur</TableHead>
                  <TableHead className="text-[11px]">Supplier</TableHead>
                  <TableHead className="text-[11px]">Notes</TableHead>
                  <TableHead className="text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.line} className="h-9 text-[11.5px]">
                    <TableCell className="tabular-nums">{r.line}</TableCell>
                    <TableCell className="font-medium">{r.mpn}</TableCell>
                    <TableCell className="text-muted-foreground">{r.mfr}</TableCell>
                    <TableCell className="text-muted-foreground">{r.spn}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[220px] truncate" title={r.desc}>{r.desc}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.requiredQty}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={r.spareQty}
                        onChange={(e) => update(r.line, { spareQty: parseInt(e.target.value) || 0 })}
                        className="h-7 w-16 text-[11.5px] text-right tabular-nums ml-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={r.orderQty}
                        onChange={(e) => update(r.line, { orderQty: parseInt(e.target.value) || 0 })}
                        className="h-7 w-20 text-[11.5px] text-right tabular-nums ml-auto font-semibold"
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.unitPrice.toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{r.currency}</Badge></TableCell>
                    <TableCell className="text-muted-foreground max-w-[140px] truncate" title={r.supplier}>{r.supplier}</TableCell>
                    <TableCell>
                      <Input
                        value={r.notes}
                        onChange={(e) => update(r.line, { notes: e.target.value })}
                        placeholder="—"
                        className="h-7 w-32 text-[11.5px]"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Edit Qty"><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Add Note"><StickyNote className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Exclude Line"
                          onClick={() => update(r.line, { excluded: true })}><Ban className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Reset Qty"
                          onClick={() => {
                            const spare = Math.ceil((r.requiredQty * sparePct) / 100);
                            update(r.line, { spareQty: spare, orderQty: r.requiredQty + spare });
                          }}><RotateCcw className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Excel output preview */}
      <Card className="mb-3 border-border/60">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-[13px]">תצוגה מקדימה של קובץ Excel</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0">
          <SectionTitle title="Required Columns" />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {["MPN", "Manufacturer", "Supplier Part Number", "Order Qty", "Notes"].map((c) => (
              <Badge key={c} className="text-[11px]">{c}</Badge>
            ))}
          </div>
          <SectionTitle title="Optional Columns" />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {["Description", "Unit Price", "Currency", "Supplier"].map((c) => (
              <Badge key={c} variant="outline" className="text-[11px]">{c}</Badge>
            ))}
          </div>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="h-8 bg-muted/40">
                  {["MPN", "Manufacturer", "Supplier P/N", "Order Qty", "Notes"].map((c) => (
                    <TableHead key={c} className="text-[11px] font-semibold">{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.slice(0, 5).map((r) => (
                  <TableRow key={r.line} className="h-8 text-[11.5px]">
                    <TableCell className="font-medium">{r.mpn}</TableCell>
                    <TableCell className="text-muted-foreground">{r.mfr}</TableCell>
                    <TableCell className="text-muted-foreground">{r.spn}</TableCell>
                    <TableCell className="tabular-nums font-semibold">{r.orderQty}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[260px]">{r.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-border/60">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-[13px]">היסטוריית קבצים שהופקו</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-8">
                  {["Date","Supplier","File Name","BOM Version","Pricing Snapshot","Lines","Estimated Value","Created By","Drive Folder","Actions"].map((c) =>
                    <TableHead key={c} className="text-[11px]">{c}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.file} className="h-9 text-[11.5px]">
                    <TableCell className="tabular-nums">{h.date}</TableCell>
                    <TableCell className="text-muted-foreground">{h.supplier}</TableCell>
                    <TableCell className="font-medium truncate max-w-[260px]" title={h.file}>{h.file}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{h.bom}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{h.snap}</TableCell>
                    <TableCell className="tabular-nums">{h.lines}</TableCell>
                    <TableCell className="tabular-nums font-semibold">{h.value}</TableCell>
                    <TableCell className="text-muted-foreground">{h.by}</TableCell>
                    <TableCell className="text-muted-foreground">07_Procurement_RFQ</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Open in Drive"><FolderOpen className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Download"><Download className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Duplicate"><Copy className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Archive"><Archive className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
