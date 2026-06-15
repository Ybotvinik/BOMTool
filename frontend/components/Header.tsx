"use client";

import { Search, Bell } from "lucide-react";
import { UserSelector } from "./UserSelector";

export function Header() {
  return (
    <header className="h-12 border-b border-slate-200 bg-white flex items-center justify-between px-4 gap-6">
      <div className="leading-tight">
        <div className="text-[14px] font-bold text-navy tracking-tight">
          GlinTech BOM Insight
        </div>
        <div className="text-[10.5px] text-slate-500 mt-0.5">
          מערכת ניתוח BOM, תמחור ורכש פנימית
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <button className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400">
          <Search className="h-3.5 w-3.5" />
        </button>
        <button className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 relative">
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute top-1 end-1 h-1.5 w-1.5 rounded-full bg-risk-critical" />
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <UserSelector />
      </div>
    </header>
  );
}
