import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RiskBadge } from "@/components/risk-badge";
import { bomLines } from "@/lib/mock-data";

export const Route = createFileRoute("/bom")({
  component: BomTable,
});

function BomTable() {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<typeof bomLines[number] | null>(null);

  return (
    <AppLayout>
      <PageHeader
        title="טבלת BOM"
        subtitle="Elbit Systems · ELB-RCB-003 · v4.2"
        actions={<Button variant="outline">ייצוא טבלה</Button>}
      />

      <Card className="p-4 mb-4 grid grid-cols-2 md:grid-cols-6 gap-3">
        <Input placeholder="חיפוש MPN..." />
        <Select><SelectTrigger><SelectValue placeholder="Risk Level" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent>
        </Select>
        <Select><SelectTrigger><SelectValue placeholder="Lifecycle" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="nrnd">NRND</SelectItem><SelectItem value="eol">EOL</SelectItem></SelectContent>
        </Select>
        <Select><SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="china">China Buyer</SelectItem><SelectItem value="rep">Official Rep</SelectItem><SelectItem value="dk">Digi-Key</SelectItem></SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Checkbox /> Needs Review</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox /> Critical only</label>
      </Card>

      <Card className="overflow-auto">
        <Table className="text-xs whitespace-nowrap">
          <TableHeader>
            <TableRow className="bg-muted/50">
              {["Line","Original MPN","Cleaned MPN","Matched MPN","Manufacturer","Original Desc","Normalized Desc","Desc Upd","Qty","Req Qty","Cust Unit","Cust Total","Int Unit","Int Total","Cust Source","Int Source","Stock","MOQ","Lead","Lifecycle","Conf","Risk","Review","Notes"].map(h => (
                <TableHead key={h} className="text-right">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bomLines.map((l) => (
              <TableRow key={l.line} className="cursor-pointer hover:bg-muted/40" onClick={() => { setRow(l); setOpen(true); }}>
                <TableCell>{l.line}</TableCell>
                <TableCell className="font-mono">{l.originalMpn}</TableCell>
                <TableCell className="font-mono">{l.cleanedMpn}</TableCell>
                <TableCell className="font-mono font-medium">{l.matchedMpn}</TableCell>
                <TableCell>{l.manufacturer}</TableCell>
                <TableCell className="max-w-[160px] truncate text-muted-foreground">{l.originalDesc}</TableCell>
                <TableCell className="max-w-[220px] truncate">{l.normalizedDesc}</TableCell>
                <TableCell>{l.descUpdated ? <Badge variant="outline" className="bg-brand/15 text-brand border-brand/30">Updated</Badge> : "—"}</TableCell>
                <TableCell>{l.qty}</TableCell>
                <TableCell>{l.requiredQty}</TableCell>
                <TableCell className="tabular-nums">${l.custUnit.toFixed(2)}</TableCell>
                <TableCell className="tabular-nums">${l.custTotal.toFixed(0)}</TableCell>
                <TableCell className="tabular-nums">${l.intUnit.toFixed(2)}</TableCell>
                <TableCell className="tabular-nums">${l.intTotal.toFixed(0)}</TableCell>
                <TableCell>{l.custSource}</TableCell>
                <TableCell className="font-medium">{l.intSource}</TableCell>
                <TableCell className={l.stock === 0 ? "text-risk-critical font-medium" : ""}>{l.stock.toLocaleString()}</TableCell>
                <TableCell>{l.moq}</TableCell>
                <TableCell>{l.leadTime}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={l.lifecycle === "Active" ? "bg-risk-low/15 text-risk-low border-risk-low/30" : l.lifecycle === "EOL" ? "bg-risk-obsolete/20 text-foreground border-risk-obsolete/40" : "bg-risk-medium/25 text-amber-700 border-risk-medium/40"}>{l.lifecycle}</Badge>
                </TableCell>
                <TableCell>{l.confidence}%</TableCell>
                <TableCell><RiskBadge level={l.risk} /></TableCell>
                <TableCell>{l.needsReview ? <Badge variant="outline" className="bg-risk-high/15 text-risk-high border-risk-high/30">Review</Badge> : "—"}</TableCell>
                <TableCell className="text-muted-foreground max-w-[140px] truncate">{l.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[480px] sm:max-w-none overflow-y-auto" dir="rtl">
          <SheetHeader><SheetTitle>פרטי שורה · {row?.matchedMpn}</SheetTitle></SheetHeader>
          {row && (
            <div className="mt-4 space-y-4 text-sm">
              <Section title="Supplier Offers">
                <Row k="Digi-Key" v={`$${(row.custUnit * 1.0).toFixed(2)} · Stock ${row.stock}`} />
                <Row k="Mouser" v={`$${(row.custUnit * 0.98).toFixed(2)} · Stock ${Math.round(row.stock * 0.7)}`} />
                <Row k="Arrow" v={`$${(row.custUnit * 1.05).toFixed(2)} · Stock ${Math.round(row.stock * 0.3)}`} />
              </Section>
              <Section title="China Buyer Quote">
                <Row k="Supplier" v="Shenzhen Huaqiang" />
                <Row k="Unit Price" v={`$${row.intUnit.toFixed(2)} (MOQ ${row.moq})`} />
                <Row k="Lead Time" v={row.leadTime} />
              </Section>
              <Section title="Official Representative Quote">
                <Row k="Rep" v="Avnet Israel" />
                <Row k="Unit Price" v={`$${(row.intUnit * 1.3).toFixed(2)}`} />
              </Section>
              <Section title="Match Explanation">
                <p className="text-muted-foreground">Exact MPN match · normalized description from authorized source · confidence {row.confidence}%.</p>
              </Section>
              <Section title="Risk Reason">
                <p className="text-muted-foreground">{row.risk === "Critical" ? "Out of stock globally + long lead." : row.risk === "High" ? "Long lead time, allocation risk." : "No material risk detected."}</p>
              </Section>
              <Section title="Internal Notes">
                <p className="text-muted-foreground">{row.notes || "—"}</p>
              </Section>
              <Section title="Customer-Safe Notes">
                <p className="text-muted-foreground">Availability and lead time confirmed at quote date.</p>
              </Section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{title}</div><div className="space-y-1">{children}</div></div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b py-1"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
