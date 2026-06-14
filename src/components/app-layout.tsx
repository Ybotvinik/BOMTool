import { Link, useRouterState } from "@tanstack/react-router";
import { navItems } from "@/lib/mock-data";
import { Cpu } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div dir="rtl" className="min-h-screen flex bg-muted/30 text-foreground">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-l bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-16 flex items-center gap-3 px-5 border-b">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center text-white shadow-sm"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Cpu className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-sm">GlinTech</div>
            <div className="text-[11px] text-muted-foreground">BOM Intelligence</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t text-[11px] text-muted-foreground">
          GLINTECH INTERNAL ONLY · v0.1
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-background flex items-center justify-between px-6">
          <div className="text-sm text-muted-foreground">GlinTech BOM Intelligence</div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground">Yossi Cohen · Procurement</div>
            <div className="h-9 w-9 rounded-full bg-brand text-brand-foreground flex items-center justify-center text-sm font-medium">
              YC
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
