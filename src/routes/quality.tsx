import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bomLines } from "@/lib/mock-data";

export const Route = createFileRoute("/quality")({
  component: Quality,
});

type Status = "Exact Match" | "Description Updated" | "Partial MPN" | "Conflict" | "Unidentified" | "Needs Review";

const statusClass: Record<Status, string> = {
  "Exact Match": "bg-risk-low/15 text-risk-low border-risk-low/40",
  "Description Updated": "bg-brand/15 text-brand border-brand/40",
  "Partial MPN": "bg-amber-500/15 text-amber-700 border-amber-500/40",
  Conflict: "bg-risk-high/15 text-risk-high border-risk-high/40",
  Unidentified: "bg-risk-critical/15 text-risk-critical border-risk-critical/40",
  "Needs Review": "bg-amber-500/15 text-amber-700 border-amber-500/40",
};

const StatusBadge = ({ s }: { s: Status }) => (
  <Badge variant="outline" className={statusClass[s]}>{s}</Badge>
);

function deriveStatus(l: typeof bomLines[number]): Status {
  if (l.confidence < 70) return "Unidentified";
  if (l.confidence < 90) return "Partial MPN";
  if (l.originalMpn !== l.matchedMpn && l.needsReview) return "Conflict";
  if (l.needsReview) return "Needs Review";
  if (l.descUpdated) return "Description Updated";
  return "Exact Match";
}

function reviewReason(l: typeof bomLines[number], s: Status): string {
  if (s === "Exact Match") return "—";
  if (l.notes) return l.notes;
  if (s === "Partial MPN") return "התאמה חלקית של MPN";
  if (s === "Description Updated") return "תיאור עודכן ממקור חיצוני";
  if (s === "Conflict") return "סתירה בין תיאור לקוח לתיאור יצרן";
  if (s === "Unidentified") return "לא זוהה רכיב במקורות";
  return "דורש אישור ידני";
}

function descSource(l: typeof bomLines[number]) {
  return l.descUpdated ? (l.custSource || "Digi-Key") : "Customer";
}

function KpiTile({ label, value, color, hint }: { label: string; value: string | number; color: string; hint?: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Quality() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<typeof bomLines[number] | null>(null);
  const [matchFilter, setMatchFilter] = useState("all");
  const [descFilter, setDescFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [mfgFilter, setMfgFilter] = useState("all");
  const [search, setSearch] = useState("");

  const manufacturers = useMemo(() => Array.from(new Set(bomLines.map(l => l.manufacturer))), []);

  const rows = useMemo(() => bomLines.map(l => ({ ...l, status: deriveStatus(l) })), []);
  const filtered = rows.filter(r => {
    if (matchFilter !== "all" && r.status !== matchFilter) return false;
    if (descFilter === "yes" && !r.descUpdated) return false;
    if (descFilter === "no" && r.descUpdated) return false;
    if (reviewFilter === "yes" && !r.needsReview) return false;
    if (reviewFilter === "no" && r.needsReview) return false;
    if (mfgFilter !== "all" && r.manufacturer !== mfgFilter) return false;
    if (search && !r.originalMpn.toLowerCase().includes(search.toLowerCase()) && !r.matchedMpn.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openRow = (l: typeof bomLines[number]) => { setSelected(l); setOpen(true); };
  const selStatus = selected ? deriveStatus(selected) : null;

  return (
    <AppLayout>
      <PageHeader
        title="איכות BOM וזיהוי רכיבים"
        subtitle="המערכת מזהה רכיבים לפי MPN, משווה לתיאור המקורי, ומעדכנת תיאור תקני ממקורות כמו Digi-Key או Mouser."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => alert("ייצוא דוח איכות BOM")}>
              ייצוא דוח איכות BOM
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewFilter(reviewFilter === "yes" ? "all" : "yes")}
            >
              הצג רק Needs Review
            </Button>
            <Button size="sm" onClick={() => alert("כל התיאורים המעודכנים אושרו")}>
              אשר תיאורים מעודכנים
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        <KpiTile label="Total BOM Lines" value="186" color="text-foreground" />
        <KpiTile label="Exact MPN Matches" value="142" color="text-risk-low" hint="76% מהשורות" />
        <KpiTile label="Partial MPNs" value="6" color="text-amber-600" />
        <KpiTile label="Updated Descriptions" value="38" color="text-brand" />
        <KpiTile label="Unidentified Parts" value="2" color="text-risk-critical" />
        <KpiTile label="Description Conflicts" value="3" color="text-risk-high" />
        <KpiTile label="Needs Review" value="14" color="text-amber-600" />
        <KpiTile label="BOM Quality Score" value="87" color="text-risk-low" hint="טוב" />
      </div>

      <Card className="p-4 mb-4 border-border/60">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Match Status</label>
            <Select value={matchFilter} onValueChange={setMatchFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="Exact Match">Exact Match</SelectItem>
                <SelectItem value="Description Updated">Description Updated</SelectItem>
                <SelectItem value="Partial MPN">Partial MPN</SelectItem>
                <SelectItem value="Conflict">Conflict</SelectItem>
                <SelectItem value="Unidentified">Unidentified</SelectItem>
                <SelectItem value="Needs Review">Needs Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description Updated</label>
            <Select value={descFilter} onValueChange={setDescFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="yes">עודכן</SelectItem>
                <SelectItem value="no">מקורי</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Needs Review</label>
            <Select value={reviewFilter} onValueChange={setReviewFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="yes">דורש בדיקה</SelectItem>
                <SelectItem value="no">תקין</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Manufacturer</label>
            <Select value={mfgFilter} onValueChange={setMfgFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל היצרנים</SelectItem>
                {manufacturers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Search by MPN</label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="הקלד MPN..." />
          </div>
        </div>
      </Card>

      <Card className="border-border/60 overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              {["Line","Original MPN","Matched MPN","Manufacturer","Original Description","Normalized Description","Desc Source","Desc Updated","Confidence","Status","Review Reason"].map(h => (
                <TableHead key={h} className="text-right whitespace-nowrap">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow key={l.line} onClick={() => openRow(l)} className="cursor-pointer hover:bg-muted/40">
                <TableCell className="tabular-nums">{l.line}</TableCell>
                <TableCell className="font-mono whitespace-nowrap">{l.originalMpn}</TableCell>
                <TableCell className="font-mono font-medium whitespace-nowrap">{l.matchedMpn}</TableCell>
                <TableCell className="whitespace-nowrap">{l.manufacturer}</TableCell>
                <TableCell className="text-muted-foreground max-w-[220px] truncate">{l.originalDesc}</TableCell>
                <TableCell className="max-w-[280px] truncate">{l.normalizedDesc}</TableCell>
                <TableCell className="whitespace-nowrap">{descSource(l)}</TableCell>
                <TableCell>{l.descUpdated ? <Badge variant="outline" className="bg-brand/10 text-brand border-brand/30">Yes</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="tabular-nums">{l.confidence}%</TableCell>
                <TableCell><StatusBadge s={l.status} /></TableCell>
                <TableCell className="text-muted-foreground max-w-[220px] truncate">{reviewReason(l, l.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground mt-4 italic">
        Original customer data is always preserved. Normalized descriptions are added as separate fields.
      </p>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto" dir="rtl">
          {selected && selStatus && (
            <>
              <SheetHeader className="text-right">
                <SheetTitle className="font-mono">{selected.matchedMpn}</SheetTitle>
                <SheetDescription>{selected.manufacturer} · שורה {selected.line}</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-3">נתוני לקוח מקוריים</div>
                  <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Original MPN</span><span className="font-mono">{selected.originalMpn}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Manufacturer</span><span>{selected.manufacturer}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Original Description</span><span className="text-right max-w-[60%]">{selected.originalDesc}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Qty</span><span className="tabular-nums">{selected.qty}</span></div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-3">נתוני ספק מנורמלים</div>
                  <div className="rounded-md border bg-brand/5 p-3 text-sm space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Matched MPN</span><span className="font-mono">{selected.matchedMpn}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Normalized Description</span><span className="text-right max-w-[60%]">{selected.normalizedDesc}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Description Source</span><span>{descSource(selected)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Lifecycle Status</span><span>{selected.lifecycle}</span></div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-3">ניתוח התאמה</div>
                  <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Match Confidence</span><span className="tabular-nums font-semibold">{selected.confidence}%</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span><StatusBadge s={selStatus} /></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Review Reason</span><span className="text-right max-w-[60%]">{reviewReason(selected, selStatus)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Description Updated</span><span>{selected.descUpdated ? "כן" : "לא"}</span></div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-3">פעולה מומלצת</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline">קבל תיאור מנורמל</Button>
                    <Button size="sm" variant="outline">בקש הבהרה מהלקוח</Button>
                    <Button size="sm" variant="outline">מצא חלופה</Button>
                    <Button size="sm" variant="outline">סמן כנבדק</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
