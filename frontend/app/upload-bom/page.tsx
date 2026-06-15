"use client";

import { useState } from "react";
import { UploadCloud, FileSpreadsheet } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";

export default function UploadBomPage() {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="טעינת BOM"
        subtitle="העלאת קובץ BOM (Excel / CSV) ליצירת גרסה חדשה"
      />
      <Card className="p-8">
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-lg py-14 cursor-pointer hover:border-brand/50 hover:bg-brand-soft/40 transition-colors">
          <UploadCloud className="h-10 w-10 text-brand" />
          <div className="text-[13px] font-medium text-slate-700">
            גרור לכאן קובץ BOM או לחץ לבחירה
          </div>
          <div className="text-[11px] text-slate-400">
            נתמך: .xlsx, .xls, .csv — אחסון מקומי (FileStorageService)
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        {fileName && (
          <div className="mt-4 flex items-center gap-2 text-[12.5px] text-slate-700">
            <FileSpreadsheet className="h-4 w-4 text-risk-low" />
            נבחר: <span className="font-medium">{fileName}</span>
            <span className="text-slate-400">(placeholder — עיבוד יתווסף בהמשך)</span>
          </div>
        )}
      </Card>
    </>
  );
}
