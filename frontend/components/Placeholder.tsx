import { Construction } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";

export function Placeholder({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="p-10 flex flex-col items-center justify-center text-center gap-2">
        <Construction className="h-9 w-9 text-brand" />
        <div className="text-[14px] font-semibold text-slate-700">
          מסך זה בפיתוח
        </div>
        <p className="text-[12px] text-slate-500 max-w-md">
          השלד מוכן. הפונקציונליות המלאה תתווסף בגרסה הבאה של GlinTech BOM Insight.
        </p>
      </Card>
    </>
  );
}
