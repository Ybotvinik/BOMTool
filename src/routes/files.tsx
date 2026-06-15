import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader, Kpi } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Folder,
  FolderOpen,
  ExternalLink,
  Download,
  Archive,
  Link2,
  Upload,
  FolderPlus,
  ChevronLeft,
  Filter,
  HardDrive,
} from "lucide-react";

export const Route = createFileRoute("/files")({
  component: Files,
});

type FileType =
  | "Source BOM"
  | "China Quote"
  | "Official Rep Quote"
  | "Customer Excel"
  | "Customer PDF"
  | "Internal Excel"
  | "Internal PDF"
  | "RFQ Package"
  | "Archive";

type FileStatus = "Active" | "Superseded" | "Archived" | "Customer Sent" | "Internal Only";

type Visibility = "Internal" | "Customer";

const typeTone: Record<FileType, string> = {
  "Source BOM": "bg-brand/15 text-brand border-brand/30",
  "China Quote": "bg-risk-low/15 text-risk-low border-risk-low/30",
  "Official Rep Quote": "bg-blue-500/15 text-blue-700 border-blue-500/30",
  "Customer Excel": "bg-purple-500/15 text-purple-700 border-purple-500/30",
  "Customer PDF": "bg-purple-500/15 text-purple-700 border-purple-500/30",
  "Internal Excel": "bg-amber-500/15 text-amber-700 border-amber-500/30",
  "Internal PDF": "bg-amber-500/15 text-amber-700 border-amber-500/30",
  "RFQ Package": "bg-pink-500/15 text-pink-700 border-pink-500/30",
  Archive: "bg-muted text-muted-foreground border-border",
};

const statusTone: Record<FileStatus, string> = {
  Active: "bg-risk-low/15 text-risk-low border-risk-low/30",
  Superseded: "bg-muted text-muted-foreground border-border",
  Archived: "bg-muted/60 text-muted-foreground border-border",
  "Customer Sent": "bg-purple-500/15 text-purple-700 border-purple-500/30",
  "Internal Only": "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

const FOLDERS = [
  { id: "01_Source_BOM", label: "01_Source_BOM", count: 5 },
  { id: "02_China_Quotes", label: "02_China_Quotes", count: 3 },
  { id: "03_Official_Rep_Quotes", label: "03_Official_Rep_Quotes", count: 2 },
  { id: "04_Processed_BOM", label: "04_Processed_BOM", count: 4 },
  { id: "05_Customer_Exports", label: "05_Customer_Exports", count: 4 },
  { id: "06_Internal_Reports", label: "06_Internal_Reports", count: 6 },
  { id: "07_Procurement_RFQ", label: "07_Procurement_RFQ", count: 2 },
  { id: "08_Archive", label: "08_Archive", count: 9 },
] as const;

type Row = {
  name: string;
  folder: string;
  type: FileType;
  version: string;
  snapshot: string;
  by: string;
  date: string;
  size: string;
  visibility: Visibility;
  status: FileStatus;
};

const files: Row[] = [
  { name: "ELB-RCB-003_BOM_v4.3.xlsx", folder: "01_Source_BOM", type: "Source BOM", version: "v4.3", snapshot: "—", by: "Yossi Cohen", date: "2026-06-12 14:22", size: "412 KB", visibility: "Internal", status: "Active" },
  { name: "ELB-RCB-003_BOM_v4.2.xlsx", folder: "01_Source_BOM", type: "Source BOM", version: "v4.2", snapshot: "—", by: "Maya Levi", date: "2026-05-28 09:10", size: "398 KB", visibility: "Internal", status: "Superseded" },
  { name: "ELB-RCB-003_BOM_v4.1.xlsx", folder: "01_Source_BOM", type: "Source BOM", version: "v4.1", snapshot: "—", by: "Maya Levi", date: "2026-05-04 16:45", size: "386 KB", visibility: "Internal", status: "Superseded" },
  { name: "ELB-RCB-003_BOM_v4.0.xlsx", folder: "01_Source_BOM", type: "Source BOM", version: "v4.0", snapshot: "—", by: "Yossi Cohen", date: "2026-04-19 11:02", size: "372 KB", visibility: "Internal", status: "Archived" },
  { name: "ELB-RCB-003_BOM_v3.5.xlsx", folder: "01_Source_BOM", type: "Source BOM", version: "v3.5", snapshot: "—", by: "Eitan Bar", date: "2026-03-02 08:30", size: "355 KB", visibility: "Internal", status: "Archived" },

  { name: "China_Quote_Huaqiang_2026-06-10.xlsx", folder: "02_China_Quotes", type: "China Quote", version: "v4.3", snapshot: "With China Quote", by: "Dana Levi", date: "2026-06-10 12:18", size: "184 KB", visibility: "Internal", status: "Active" },
  { name: "China_Quote_Shenzhen_2026-06-04.xlsx", folder: "02_China_Quotes", type: "China Quote", version: "v4.2", snapshot: "v4.2 Final", by: "Dana Levi", date: "2026-06-04 09:51", size: "172 KB", visibility: "Internal", status: "Superseded" },
  { name: "China_Quote_LCSC_2026-05-12.xlsx", folder: "02_China_Quotes", type: "China Quote", version: "v4.1", snapshot: "v4.1 Manual", by: "Dana Levi", date: "2026-05-12 10:02", size: "168 KB", visibility: "Internal", status: "Archived" },

  { name: "Avnet_Rep_Quote_2026-06-08.xlsx", folder: "03_Official_Rep_Quotes", type: "Official Rep Quote", version: "v4.3", snapshot: "Rep Quote — Avnet", by: "Yossi Cohen", date: "2026-06-08 15:30", size: "92 KB", visibility: "Internal", status: "Active" },
  { name: "Arrow_Rep_Quote_2026-05-22.xlsx", folder: "03_Official_Rep_Quotes", type: "Official Rep Quote", version: "v4.2", snapshot: "—", by: "Yossi Cohen", date: "2026-05-22 11:14", size: "88 KB", visibility: "Internal", status: "Superseded" },

  { name: "ELB-RCB-003_Processed_v4.3.xlsx", folder: "04_Processed_BOM", type: "Internal Excel", version: "v4.3", snapshot: "With China Quote", by: "System", date: "2026-06-13 10:20", size: "522 KB", visibility: "Internal", status: "Active" },
  { name: "ELB-RCB-003_Processed_v4.2.xlsx", folder: "04_Processed_BOM", type: "Internal Excel", version: "v4.2", snapshot: "v4.2 Final", by: "System", date: "2026-05-29 12:05", size: "498 KB", visibility: "Internal", status: "Superseded" },
  { name: "ELB-RCB-003_Processed_v4.1.xlsx", folder: "04_Processed_BOM", type: "Internal Excel", version: "v4.1", snapshot: "—", by: "System", date: "2026-05-06 09:18", size: "486 KB", visibility: "Internal", status: "Archived" },
  { name: "ELB-RCB-003_Processed_v4.0.xlsx", folder: "04_Processed_BOM", type: "Internal Excel", version: "v4.0", snapshot: "—", by: "System", date: "2026-04-20 13:35", size: "468 KB", visibility: "Internal", status: "Archived" },

  { name: "ELB-RCB-003_Customer_v4.3.xlsx", folder: "05_Customer_Exports", type: "Customer Excel", version: "v4.3", snapshot: "With China Quote", by: "Yossi Cohen", date: "2026-06-13 16:02", size: "264 KB", visibility: "Customer", status: "Customer Sent" },
  { name: "ELB-RCB-003_Customer_v4.3.pdf", folder: "05_Customer_Exports", type: "Customer PDF", version: "v4.3", snapshot: "With China Quote", by: "Yossi Cohen", date: "2026-06-13 16:03", size: "612 KB", visibility: "Customer", status: "Customer Sent" },
  { name: "ELB-RCB-003_Customer_v4.2.pdf", folder: "05_Customer_Exports", type: "Customer PDF", version: "v4.2", snapshot: "v4.2 Final", by: "Yossi Cohen", date: "2026-05-30 09:40", size: "588 KB", visibility: "Customer", status: "Superseded" },
  { name: "ELB-RCB-003_Customer_v4.1.pdf", folder: "05_Customer_Exports", type: "Customer PDF", version: "v4.1", snapshot: "—", by: "Yossi Cohen", date: "2026-05-07 14:11", size: "574 KB", visibility: "Customer", status: "Archived" },

  { name: "Internal_Cost_Report_v4.3.pdf", folder: "06_Internal_Reports", type: "Internal PDF", version: "v4.3", snapshot: "With China Quote", by: "System", date: "2026-06-13 17:00", size: "812 KB", visibility: "Internal", status: "Internal Only" },
  { name: "Internal_Risk_Report_v4.3.pdf", folder: "06_Internal_Reports", type: "Internal PDF", version: "v4.3", snapshot: "—", by: "System", date: "2026-06-13 17:04", size: "742 KB", visibility: "Internal", status: "Internal Only" },
  { name: "Internal_Margin_Report_v4.3.xlsx", folder: "06_Internal_Reports", type: "Internal Excel", version: "v4.3", snapshot: "With China Quote", by: "System", date: "2026-06-13 17:06", size: "302 KB", visibility: "Internal", status: "Internal Only" },
  { name: "Internal_Cost_Report_v4.2.pdf", folder: "06_Internal_Reports", type: "Internal PDF", version: "v4.2", snapshot: "v4.2 Final", by: "System", date: "2026-05-29 18:20", size: "788 KB", visibility: "Internal", status: "Superseded" },
  { name: "Internal_Risk_Report_v4.2.pdf", folder: "06_Internal_Reports", type: "Internal PDF", version: "v4.2", snapshot: "—", by: "System", date: "2026-05-29 18:22", size: "720 KB", visibility: "Internal", status: "Superseded" },
  { name: "Internal_Margin_Report_v4.1.xlsx", folder: "06_Internal_Reports", type: "Internal Excel", version: "v4.1", snapshot: "—", by: "System", date: "2026-05-06 19:00", size: "286 KB", visibility: "Internal", status: "Archived" },

  { name: "RFQ_Package_China_2026-06-10.zip", folder: "07_Procurement_RFQ", type: "RFQ Package", version: "v4.3", snapshot: "—", by: "Dana Levi", date: "2026-06-10 14:00", size: "2.4 MB", visibility: "Internal", status: "Active" },
  { name: "RFQ_Package_Avnet_2026-06-08.zip", folder: "07_Procurement_RFQ", type: "RFQ Package", version: "v4.3", snapshot: "—", by: "Yossi Cohen", date: "2026-06-08 16:30", size: "1.8 MB", visibility: "Internal", status: "Active" },

  { name: "ELB-RCB-003_BOM_v3.5_archive.xlsx", folder: "08_Archive", type: "Archive", version: "v3.5", snapshot: "—", by: "Eitan Bar", date: "2026-03-02 08:35", size: "355 KB", visibility: "Internal", status: "Archived" },
  { name: "v4.0_Pricing_Snapshot_archive.xlsx", folder: "08_Archive", type: "Archive", version: "v4.0", snapshot: "v4.0 Final", by: "System", date: "2026-04-21 09:00", size: "412 KB", visibility: "Internal", status: "Archived" },
];

function ContextBar() {
  const items = [
    ["Customer", "Elbit Systems"],
    ["Project", "Radar Control Board v3"],
    ["Project Code", "ELB-RCB-003"],
    ["Active BOM", "v4.3"],
    ["Pricing Snapshot", "With China Quote"],
    ["Shared Drive", "GlinTech BOM Intelligence"],
  ];
  return (
    <Card className="mb-3 py-0">
      <CardContent className="p-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
        {items.map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{k}:</span>
            <span className="font-semibold tracking-tight">{v}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FolderTree({
  selected,
  onSelect,
}: {
  selected: string | "all";
  onSelect: (id: string | "all") => void;
}) {
  return (
    <Card className="py-0">
      <CardHeader className="py-2 px-3 border-b bg-muted/40">
        <CardTitle className="text-xs font-semibold flex items-center gap-2">
          <HardDrive className="h-3.5 w-3.5" /> Drive Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 text-[12px] font-mono leading-tight">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Folder className="h-3.5 w-3.5" /> /Customers
        </div>
        <div className="ms-3 flex items-center gap-1 text-muted-foreground">
          <Folder className="h-3.5 w-3.5" /> /Elbit Systems
        </div>
        <button
          onClick={() => onSelect("all")}
          className={`ms-6 flex items-center gap-1 w-full text-start rounded px-1 py-0.5 ${
            selected === "all" ? "bg-brand/10 text-brand font-semibold" : "hover:bg-muted/60"
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" /> /ELB-RCB-003 — Radar Control Board v3
        </button>
        <div className="ms-9 mt-0.5 space-y-0.5">
          {FOLDERS.map((f) => {
            const active = selected === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onSelect(f.id)}
                className={`flex items-center gap-1.5 w-full text-start rounded px-1 py-0.5 ${
                  active ? "bg-brand/10 text-brand font-semibold" : "hover:bg-muted/60"
                }`}
              >
                <ChevronLeft className="h-3 w-3 opacity-40" />
                <Folder className="h-3.5 w-3.5" />
                <span className="flex-1 truncate">/{f.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{f.count}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Files() {
  const [folder, setFolder] = useState<string | "all">("all");
  const [fType, setFType] = useState("all");
  const [fVer, setFVer] = useState("all");
  const [fVis, setFVis] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      files.filter((f) => {
        if (folder !== "all" && f.folder !== folder) return false;
        if (fType !== "all" && f.type !== fType) return false;
        if (fVer !== "all" && f.version !== fVer) return false;
        if (fVis !== "all" && f.visibility !== fVis) return false;
        if (fStatus !== "all" && f.status !== fStatus) return false;
        if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [folder, fType, fVer, fVis, fStatus, search]
  );

  return (
    <AppLayout>
      <PageHeader
        title="קבצי פרויקט"
        subtitle="ניהול קבצי מקור, מחירונים, דוחות וארכיון עבור הפרויקט ב-Google Shared Drive."
        actions={
          <>
            <Button size="sm" variant="outline">
              <Archive className="h-3.5 w-3.5 ml-1" /> ארכב קבצים ישנים
            </Button>
            <Button size="sm" variant="outline">
              <FolderPlus className="h-3.5 w-3.5 ml-1" /> צור תיקיות פרויקט
            </Button>
            <Button size="sm" variant="outline">
              <Upload className="h-3.5 w-3.5 ml-1" /> העלה קובץ
            </Button>
            <Button size="sm">
              <ExternalLink className="h-3.5 w-3.5 ml-1" /> פתח תיקיית Drive
            </Button>
          </>
        }
      />

      <ContextBar />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        <Kpi label="Source BOM Files" value="5" tone="good" />
        <Kpi label="China Quote Files" value="3" />
        <Kpi label="Official Rep Quotes" value="2" />
        <Kpi label="Customer Exports" value="4" />
        <Kpi label="Internal Reports" value="6" tone="warn" />
        <Kpi label="Archived Files" value="9" />
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Left: folder tree */}
        <div className="col-span-12 lg:col-span-3">
          <FolderTree selected={folder} onSelect={setFolder} />
        </div>

        {/* Right: filters + table */}
        <div className="col-span-12 lg:col-span-9 space-y-2">
          <Card className="py-0">
            <CardContent className="p-2 flex flex-wrap items-end gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> סינון:
              </div>
              <Select value={folder} onValueChange={(v) => setFolder(v as string)}>
                <SelectTrigger className="h-7 w-44 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Folders</SelectItem>
                  {FOLDERS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fType} onValueChange={setFType}>
                <SelectTrigger className="h-7 w-40 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All File Types</SelectItem>
                  {Object.keys(typeTone).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fVer} onValueChange={setFVer}>
                <SelectTrigger className="h-7 w-28 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Versions</SelectItem>
                  {["v4.3", "v4.2", "v4.1", "v4.0", "v3.5"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fVis} onValueChange={setFVis}>
                <SelectTrigger className="h-7 w-36 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Internal / Customer</SelectItem>
                  <SelectItem value="Internal">Internal</SelectItem>
                  <SelectItem value="Customer">Customer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-7 w-36 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.keys(statusTone).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search file name…"
                className="h-7 w-52 text-[12px]"
              />
              <div className="ms-auto text-[11px] text-muted-foreground">
                מציג <span className="font-semibold text-foreground">{filtered.length}</span> מתוך {files.length}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden py-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {[
                      "File Name",
                      "Folder",
                      "Type",
                      "BOM Ver.",
                      "Pricing Snapshot",
                      "Uploaded By",
                      "Uploaded",
                      "Size",
                      "Visibility",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <TableHead key={h} className="h-8 text-[11px] whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => (
                    <TableRow key={f.name} className="text-[12px]">
                      <TableCell className="font-mono text-[11px] font-medium max-w-[260px] truncate" title={f.name}>
                        {f.name}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">/{f.folder}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeTone[f.type]}>{f.type}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{f.version}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{f.snapshot}</TableCell>
                      <TableCell>{f.by}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-[11px]">{f.date}</TableCell>
                      <TableCell className="tabular-nums text-[11px]">{f.size}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            f.visibility === "Customer"
                              ? "bg-purple-500/15 text-purple-700 border-purple-500/30"
                              : "bg-amber-500/15 text-amber-700 border-amber-500/30"
                          }
                        >
                          {f.visibility}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusTone[f.status]}>{f.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" title="Open in Drive">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" title="Download">
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" title="Link to Version">
                            <Link2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" title="Archive">
                            <Archive className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-[12px] text-muted-foreground py-6">
                        אין קבצים שתואמים את הסינון.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <p className="text-[11px] text-muted-foreground">
            פעולות Drive במצב prototype — קישורים ופעולות הקבצים אינם מחוברים ל-Google Drive API.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
