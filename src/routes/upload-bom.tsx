import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/upload-bom")({
  component: UploadBom,
});

function UploadBom() {
  return (
    <AppLayout>
      <PageHeader title="טעינת BOM" subtitle="העלאה, מיפוי וייבוא קובץ BOM של לקוח" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">1. העלאת קובץ</CardTitle></CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-10 text-center bg-muted/30">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">גרור קובץ Excel לכאן</p>
              <p className="text-xs text-muted-foreground mt-1">XLSX / XLS · עד 20MB</p>
              <Button className="mt-4" variant="outline">בחר קובץ</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">2. הקשר לפרויקט</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Customer</Label>
              <Select><SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                <SelectContent><SelectItem value="elbit">Elbit Systems</SelectItem><SelectItem value="rafael">Rafael</SelectItem><SelectItem value="iai">IAI</SelectItem></SelectContent></Select>
            </div>
            <div><Label>Project</Label>
              <Select><SelectTrigger><SelectValue placeholder="בחר פרויקט" /></SelectTrigger>
                <SelectContent><SelectItem value="rcb">Radar Control Board v3</SelectItem><SelectItem value="upd">UAV Power Distribution</SelectItem></SelectContent></Select>
            </div>
            <div>
              <Label className="mb-2 block">Version Strategy</Label>
              <RadioGroup defaultValue="new" className="space-y-1">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="new" /> צור גרסת BOM חדשה</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="overwrite" /> דריסת גרסה קיימת (תועבר לארכיון)</label>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">3. מיפוי עמודות</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {["MPN","Manufacturer","Description","Quantity","Reference Designators","Package"].map((f) => (
              <div key={f}>
                <Label>{f}</Label>
                <Select defaultValue={f}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[f, "Column A", "Column B", "Column C", "Column D"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              המק״ט הוא השדה המוביל לזיהוי הרכיב. תיאור הלקוח נשמר אך ניתן לעדכון ממקורות חיצוניים.
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground mb-2">תצוגה מקדימה (5 שורות ראשונות):</div>
          <Table>
            <TableHeader><TableRow>{["MPN","Manufacturer","Description","Qty","RefDes","Pkg"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell className="font-mono">STM32F407VGT6</TableCell><TableCell>ST</TableCell><TableCell>MCU 32-bit</TableCell><TableCell>1</TableCell><TableCell>U1</TableCell><TableCell>LQFP100</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">LM358N</TableCell><TableCell>TI</TableCell><TableCell>Dual Op-Amp</TableCell><TableCell>2</TableCell><TableCell>U2,U3</TableCell><TableCell>DIP8</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">TPS54331DR</TableCell><TableCell>TI</TableCell><TableCell>Buck 3A</TableCell><TableCell>1</TableCell><TableCell>U4</TableCell><TableCell>SOIC8</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">XC7A35T-1FTG256C</TableCell><TableCell>Xilinx</TableCell><TableCell>FPGA</TableCell><TableCell>1</TableCell><TableCell>U5</TableCell><TableCell>FTBGA256</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">ADXL345BCCZ</TableCell><TableCell>ADI</TableCell><TableCell>Accel</TableCell><TableCell>1</TableCell><TableCell>U6</TableCell><TableCell>LGA14</TableCell></TableRow>
            </TableBody>
          </Table>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline">ביטול</Button>
            <Button style={{ background: "var(--gradient-brand)" }} className="text-white">ייבוא BOM</Button>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
