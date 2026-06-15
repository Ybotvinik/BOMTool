"use client";

import { useState } from "react";
import { ChevronDown, Check, Info } from "lucide-react";
import { useCurrentUser } from "@/lib/current-user";

export function UserSelector() {
  const { user, setUser, users } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const tip =
    "המשתמש הפעיל משמש לתיעוד פעולות במערכת. במימוש אמיתי המשתמש יזוהה באמצעות Google Workspace.";

  return (
    <div className="relative">
      <button
        title={tip}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-8 px-1.5 rounded-md hover:bg-slate-100 transition-colors"
      >
        <div className="h-7 w-7 rounded-full bg-brand text-brand-fg flex items-center justify-center text-[11px] font-semibold">
          {user.initials}
        </div>
        <div className="text-right leading-tight">
          <div className="text-[11px] font-medium text-slate-800">{user.name}</div>
          <div className="text-[9.5px] text-slate-500">משתמש פעיל</div>
        </div>
        <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-1 w-64 rounded-md border border-slate-200 bg-white shadow-lg z-20 p-1">
            <div className="px-2 py-1.5 text-[11px] text-slate-500">
              החלפת משתמש פעיל
            </div>
            <div className="h-px bg-slate-100" />
            {users.map((u) => {
              const active = u.id === user.id;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setUser(u);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-slate-100"
                >
                  <div className="h-6 w-6 rounded-full bg-brand-soft text-brand flex items-center justify-center text-[10px] font-semibold">
                    {u.initials}
                  </div>
                  <span className="flex-1 text-right">{u.name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-brand" />}
                </button>
              );
            })}
            <div className="h-px bg-slate-100 my-1" />
            <div className="px-2 py-1.5 text-[10.5px] text-slate-500 leading-snug flex gap-1.5">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{tip}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
