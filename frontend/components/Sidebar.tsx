"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-l border-slate-200 bg-white flex flex-col">
      <div className="h-12 flex items-center justify-center px-3 border-b border-slate-200 bg-navy">
        <span className="text-white font-bold tracking-tight text-[15px]">
          GlinTech
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/projects" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2 h-[34px] px-2.5 rounded-md text-[12.5px] border transition-colors",
                active
                  ? "bg-brand-soft text-brand font-semibold border-brand/20"
                  : "text-slate-600 hover:bg-slate-100 border-transparent",
              )}
            >
              <Icon
                className={clsx(
                  "h-3.5 w-3.5 shrink-0",
                  active ? "text-brand" : "text-slate-400",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-2 border-t border-slate-200 text-[10px] tracking-wider text-amber-700 font-semibold flex items-center gap-1.5">
        <Lock className="h-3 w-3" /> GLINTECH INTERNAL ONLY · v0.1
      </div>
    </aside>
  );
}
