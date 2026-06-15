import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useCurrentUser, USERS } from "@/lib/current-user";
import { Info, History } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/audit-log")({
  component: AuditLogPage,
});

type Entry = {
  ts: string;
  userIdx: number;
  action: string;
  target: string;
  detail: string;
};

const BASE_ENTRIES: Entry[] = [
  { ts: "2026-06-15 09:42", userIdx: 0, action: "ייצוא קובץ רכש", target: "ELB-RCB-003 / v4.2", detail: "ProcurementFile_ELB-RCB-003_v4.2.xlsx" },
  { ts: "2026-06-15 09:18", userIdx: 2, action: "עריכת שורה", target: "BOM line #4 (XC7A35T-1FTG256C)", detail: "הוספת הערה: Allocation" },
  { ts: "2026-06-14 17:05", userIdx: 1, action: "טעינת BOM", target: "ELB-RCB-003", detail: "ELB-RCB_v4.2.xlsx" },
  { ts: "2026-06-14 16:50", userIdx: 0, action: "יצירת גרסה", target: "v4.2", detail: "השוואה מול v4.1: 8 שינויים" },
  { ts: "2026-06-14 12:11", userIdx: 2, action: "ייצוא דוח", target: "China Quote Summary", detail: "ChinaQuote_ELB-RCB_2026-06-14.xlsx" },
  { ts: "2026-06-13 15:30", userIdx: 1, action: "ארכוב גרסה", target: "v4.1", detail: "סטטוס שונה ל-Archived" },
  { ts: "2026-06-13 11:08", userIdx: 0, action: "עדכון הגדרות", target: "מקורות ספקים", detail: "LCSC הוגדר כ-כבוי" },
  { ts: "2026-06-12 18:22", userIdx: 3, action: "דריסת קובץ", target: "ELB-RCB_v4.2.xlsx", detail: "החלפת קובץ ב-Drive" },
  { ts: "2026-06-12 10:14", userIdx: 2, action: "עריכה אחרונה", target: "BOM line #9 (AD7920ARTZ)", detail: "סימון Critical" },
  { ts: "2026-06-11 14:45", userIdx: 1, action: "יצירת פרויקט", target: "RFL-UPD-011", detail: "פרויקט חדש" },
];

function AuditLogPage() {
  const { user } = useCurrentUser();
  const entries = useMemo(() => {
    // Inject current user as the most recent entry so selector changes are visible
    const live: Entry = {
      ts: "2026-06-15 10:01",
      userIdx: -1,
      action: "פתיחת יומן פעולות",
      target: "Audit Log",
      detail: "צפייה ביומן",
    };
    return [live, ...BASE_ENTRIES];
  }, [user.name]);

  return (
    <AppLayout>
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div className="leading-tight">
            <h1 className="text-[16px] font-bold text-[var(--navy)] flex items-center gap-2">
              <History className="h-4 w-4" /> יומן פעולות
            </h1>
            <p className="text-[11.5px] text-muted-foreground mt-1">
              תיעוד פעולות במערכת לפי המשתמש הפעיל. ההיסטוריה משמשת למעקב audit פנימי.
            </p>
          </div>
          <div className="text-[11px] text-muted-foreground bg-muted/60 border border-border rounded px-2 py-1 flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            משתמש פעיל: <span className="font-semibold text-foreground">{user.name}</span>
          </div>
        </div>

        <div className="bg-background border border-border rounded-md overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/60 text-[11px] text-muted-foreground">
              <tr className="text-right">
                <th className="px-3 py-2 font-medium w-[140px]">תאריך ושעה</th>
                <th className="px-3 py-2 font-medium w-[160px]">משתמש</th>
                <th className="px-3 py-2 font-medium w-[160px]">פעולה</th>
                <th className="px-3 py-2 font-medium w-[220px]">יעד</th>
                <th className="px-3 py-2 font-medium">פרטים</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const u = e.userIdx === -1 ? user : USERS[e.userIdx];
                return (
                  <tr key={i} className="border-t border-border hover:bg-[#F8FAFC] h-[36px]">
                    <td className="px-3 text-muted-foreground tabular-nums">{e.ts}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-brand/10 text-brand flex items-center justify-center text-[9.5px] font-semibold">
                          {u.initials}
                        </div>
                        <span>{u.name}</span>
                      </div>
                    </td>
                    <td className="px-3">{e.action}</td>
                    <td className="px-3 text-[var(--navy)]">{e.target}</td>
                    <td className="px-3 text-muted-foreground truncate">{e.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3 w-3 mt-0.5" />
          <span>
            במימוש אמיתי המשתמש יזוהה באמצעות Google Workspace, וכל פעולה תירשם אוטומטית עם זיהוי המשתמש המאומת.
          </span>
        </div>
      </div>
    </AppLayout>
  );
}
