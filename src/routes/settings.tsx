import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  RotateCcw,
  Download,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  Cpu,
  ChevronLeft,
  Globe,
  Package,
  DollarSign,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  return (
    <AppLayout>
      <PageHeader
        title="הגדרות"
        subtitle="הגדרות ברירת מחדל לתמחור, קבצים, דוחות והתנהגות המערכת."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-[11px] gap-1.5">
              <RotateCcw className="h-3 w-3" /> שחזר ברירות מחדל
            </Button>
            <Button
              size="sm"
              className="h-8 text-[11px] gap-1.5 text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Save className="h-3 w-3" /> שמור הגדרות
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* 1. General Settings */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-brand" /> הגדרות כלליות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Default Currency</Label>
                <Select defaultValue="usd">
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="ils">ILS</SelectItem>
                    <SelectItem value="rmb">RMB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Default BOM Type</Label>
                <Select defaultValue="pcb">
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcb">PCB</SelectItem>
                    <SelectItem value="smt">SMT Assembly BOM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Default Build Quantities</Label>
              <Input defaultValue="100, 500, 1,000, 10,000" className="h-8 text-[12px]" />
              <p className="text-[10px] text-muted-foreground">מופרדות בפסיקים. יופיעו כאפשרויות בכל פרויקט חדש.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Default Scrap Factor</Label>
                <Input defaultValue="3%" className="h-8 text-[12px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Default Report Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="he">Hebrew</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Pricing Policy */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-brand" /> מדיניות תמחור
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1">
              <Label className="text-[11px]">Customer Pricing Policy</Label>
              <Select defaultValue="best">
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="best">Best Authorized Available Price</SelectItem>
                  <SelectItem value="highest">Highest Authorized Price</SelectItem>
                  <SelectItem value="avg">Average Authorized Price</SelectItem>
                  <SelectItem value="manual">Manual Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Internal Cost Policy</Label>
              <Select defaultValue="lowest">
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lowest">Lowest Approved Internal Source</SelectItem>
                  <SelectItem value="china">Prefer China Buyer if valid</SelectItem>
                  <SelectItem value="manual">Manual Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">China Quote Validity (days)</Label>
                <Input defaultValue="14" type="number" className="h-8 text-[12px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Official Rep Validity (days)</Label>
                <Input defaultValue="30" type="number" className="h-8 text-[12px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Online Price Refresh (days)</Label>
                <Input defaultValue="1" type="number" className="h-8 text-[12px]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Supplier Sources */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-brand" /> מקורות ספקים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                { label: "Digi-Key", defaultChecked: true },
                { label: "Mouser", defaultChecked: true },
                { label: "LCSC", defaultChecked: true },
                { label: "Official Rep Quote", defaultChecked: true },
                { label: "China Buyer Quote", defaultChecked: true },
                { label: "Existing GlinTech Stock", defaultChecked: false },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between h-8">
                  <Label className="text-[12px] cursor-pointer" htmlFor={`source-${s.label}`}>
                    {s.label}
                  </Label>
                  <Switch id={`source-${s.label}`} defaultChecked={s.defaultChecked} />
                </div>
              ))}
            </div>
            <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-700 leading-snug">
                בשלב Prototype אין חיבור API אמיתי. המקורות מוצגים לצורך הדגמה בלבד.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. BOM Matching Rules */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-brand" /> כללי התאמת BOM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Min Match Confidence — Standard Parts</Label>
                <Input defaultValue="90%" className="h-8 text-[12px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Min Match Confidence — Critical Parts</Label>
                <Input defaultValue="98%" className="h-8 text-[12px]" />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {[
                { id: "partial-mpn", label: "Treat partial MPN as Needs Review", checked: true },
                { id: "keep-desc", label: "Keep Original Description always", checked: true },
                { id: "add-normalized", label: "Add Normalized Description from supplier source", checked: true },
              ].map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox id={item.id} defaultChecked={item.checked} />
                  <Label htmlFor={item.id} className="text-[12px] cursor-pointer font-normal">
                    {item.label}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 5. Risk Rules */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-brand" /> כללי סיכון
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {[
                { id: "risk-eol", label: "Mark EOL / Obsolete as Critical", checked: true },
                { id: "risk-missing", label: "Mark missing stock as Critical", checked: true },
                { id: "risk-insufficient", label: "Mark insufficient stock as High/Critical", checked: true },
                { id: "risk-lead", label: "Mark long lead time as High", checked: true },
                { id: "risk-alt", label: "Mark alternative PN as Needs Review", checked: true },
                { id: "risk-auth", label: "Mark non-authorized source for critical component as Approval Required", checked: true },
              ].map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <Checkbox id={item.id} defaultChecked={item.checked} className="mt-0.5" />
                  <Label htmlFor={item.id} className="text-[12px] cursor-pointer font-normal leading-snug">
                    {item.label}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 6. Google Shared Drive */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-brand" /> Google Shared Drive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Shared Drive Name</Label>
                <Input defaultValue="GlinTech BOM Intelligence" className="h-8 text-[12px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Root Folder</Label>
                <Input defaultValue="/Customers" className="h-8 text-[12px]" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Customer Exports</Label>
                <Input defaultValue="05_Customer_Exports" className="h-8 text-[12px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Internal Reports</Label>
                <Input defaultValue="06_Internal_Reports" className="h-8 text-[12px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Archive Folder</Label>
                <Input defaultValue="08_Archive" className="h-8 text-[12px]" />
              </div>
            </div>

            <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 mt-1">
              <p className="text-[11px] text-muted-foreground mb-1.5">תצוגת תיקיות</p>
              <div className="flex items-center gap-1 text-[12px] text-foreground font-medium">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Customers</span>
                <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                <span>Customer Name</span>
                <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                <span>Project Code - Project Name</span>
                <ChevronLeft className="h-3 w-3 text-muted-erts" />
                <span className="text-muted-foreground">...</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7. Export Defaults */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
              <Download className="h-4 w-4 text-brand" /> ברירות מחדל לייצוא
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Customer Excel Template</Label>
                <Select defaultValue="default">
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Customer Excel</SelectItem>
                    <SelectItem value="elbit">Elbit Systems Format</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Customer PDF Template</Label>
                <Select defaultValue="default">
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Customer PDF</SelectItem>
                    <SelectItem value="elbit">Elbit Systems Format</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Internal Excel Template</Label>
                <Select defaultValue="default">
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Internal Excel</SelectItem>
                    <SelectItem value="pricing">Pricing Analysis Format</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Internal PDF Template</Label>
                <Select defaultValue="default">
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Internal PDF</SelectItem>
                    <SelectItem value="pricing">Pricing Analysis Format</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              {[
                { id: "logo", label: "Include GlinTech logo", checked: true },
                { id: "timestamp", label: "Include timestamp", checked: true },
                { id: "footer", label: 'Add "GLINTECH INTERNAL ONLY" footer to internal reports', checked: true },
              ].map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox id={item.id} defaultChecked={item.checked} />
                  <Label htmlFor={item.id} className="text-[12px] cursor-pointer font-normal">
                    {item.label}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 8. System Info */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-brand" /> מידע מערכת
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
              {[
                { label: "Version", value: "v0.1" },
                { label: "Environment", value: "Prototype" },
                { label: "Last Updated", value: "15/06/2026" },
                { label: "API Integrations", value: "Mock only" },
                { label: "Drive Integration", value: "Mock only" },
              ].map((row) => (
                <div key={row.label} className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{row.label}</span>
                  <span className="text-[13px] font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom action buttons */}
      <div className="mt-4 flex items-center gap-2">
        <Button className="h-8 text-[12px] gap-1.5 text-white" style={{ background: "var(--gradient-brand)" }}>
          <Save className="h-3.5 w-3.5" /> שמור הגדרות
        </Button>
        <Button variant="outline" className="h-8 text-[12px] gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> שחזר ברירות מחדל
        </Button>
        <Button variant="outline" className="h-8 text-[12px] gap-1.5">
          <Download className="h-3.5 w-3.5" /> ייצוא הגדרות
        </Button>
        <Button variant="outline" className="h-8 text-[12px] gap-1.5">
          <CheckCircle className="h-3.5 w-3.5" /> בדיקת תקינות
        </Button>
      </div>
    </AppLayout>
  );
}
