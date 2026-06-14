import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  return (
    <AppLayout>
      <PageHeader title="הגדרות" subtitle="הגדרות ברירת מחדל למערכת" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Build & Costing</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Default Build Quantity</Label><Input defaultValue="100" type="number" /></div>
            <div><Label>Scrap Factor (%)</Label><Input defaultValue="2.5" type="number" step="0.1" /></div>
            <div><Label>Default Currency</Label>
              <Select defaultValue="usd"><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="usd">USD</SelectItem><SelectItem value="eur">EUR</SelectItem><SelectItem value="ils">ILS</SelectItem></SelectContent></Select>
            </div>
            <div><Label>China Quote Validity (days)</Label><Input defaultValue="30" type="number" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Customer Pricing Policy</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select defaultValue="best">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="best">Best Authorized Available Price</SelectItem>
                <SelectItem value="highest">Highest Authorized Price</SelectItem>
                <SelectItem value="avg">Average Authorized Price</SelectItem>
                <SelectItem value="manual">Manual Selection</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">המדיניות תוחל אוטומטית על פרויקטים חדשים. ניתן לדרוס ברמת פרויקט.</p>

            <div className="pt-2"><Label>Customer Export Default Language</Label>
              <Select defaultValue="en"><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="he">Hebrew</SelectItem></SelectContent></Select>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Google Shared Drive</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Shared Drive Folder Name Pattern</Label>
              <Input defaultValue="{customer}_{project_code}_{year}" />
              <p className="text-xs text-muted-foreground mt-1">לדוגמה: ELB_ELB-RCB-003_2026</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex justify-end">
        <Button style={{ background: "var(--gradient-brand)" }} className="text-white">שמירת הגדרות</Button>
      </div>
    </AppLayout>
  );
}
