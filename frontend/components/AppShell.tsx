import type { ReactNode } from "react";
import { CurrentUserProvider } from "@/lib/current-user";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CurrentUserProvider>
      <div dir="rtl" className="min-h-screen flex bg-slate-100 text-slate-800">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-auto p-4">{children}</main>
          <footer className="border-t border-slate-200 bg-white px-4 py-1.5 text-[10px] tracking-wider text-slate-500 flex items-center justify-between">
            <span className="text-amber-700 font-semibold">
              GLINTECH INTERNAL ONLY · v0.1
            </span>
            <span>© 2026 GlinTech Ltd. · GlinTech BOM Insight</span>
          </footer>
        </div>
      </div>
    </CurrentUserProvider>
  );
}
