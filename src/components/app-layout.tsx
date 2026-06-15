import { Link, useRouterState } from "@tanstack/react-router";
import { navItems } from "@/lib/mock-data";
import { Search, Bell, Lock, ChevronDown, Check, Info } from "lucide-react";
import glintechLogo from "@/assets/glintech-logo.png.asset.json";
import { useCurrentUser } from "@/lib/current-user";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div dir="rtl" className="min-h-screen flex bg-muted/30 text-foreground">
      {/* Sidebar (right in RTL) */}
      <aside className="w-52 shrink-0 border-l bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-11 flex items-center justify-center px-2 border-b bg-[var(--navy)]">
          <img
            src={glintechLogo.url}
            alt="GlinTech"
            className="object-contain"
            style={{ width: 118, height: 32 }}
          />
        </div>
        <nav className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 h-[34px] px-2.5 rounded-md text-[12.5px] transition-colors ${
                  active
                    ? "bg-brand/10 text-brand font-semibold border border-brand/20"
                    : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80 border border-transparent"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-brand" : "text-muted-foreground"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-1.5 border-t text-[10px] tracking-wider text-amber-700 font-semibold flex items-center gap-1.5">
          <Lock className="h-3 w-3" /> GLINTECH INTERNAL ONLY · v0.1
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b bg-background flex items-center justify-between px-4 gap-6">
          <div className="leading-tight">
            <div className="text-[14px] font-bold text-[var(--navy)] tracking-tight">GlinTech BOM Insight</div>
            <div className="text-[10.5px] text-muted-foreground mt-0.5">מערכת ניתוח BOM, תמחור ורכש פנימית</div>
          </div>
          <div className="flex items-center gap-2.5">
            <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
            </button>
            <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground relative">
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-risk-critical" />
            </button>
            <div className="h-5 w-px bg-border" />
            <UserSelector />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3">{children}</main>
        <footer className="border-t bg-background px-4 py-1 text-[10px] tracking-wider text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
            <Lock className="h-3 w-3" /> GLINTECH INTERNAL ONLY · v0.1
          </span>
          <span>© 2026 GlinTech Ltd. · GlinTech BOM Insight</span>
        </footer>
      </div>
    </div>
  );
}

function UserSelector() {
  const { user, setUser, users } = useCurrentUser();
  const tip =
    "המשתמש הפעיל משמש לתיעוד פעולות במערכת. במימוש אמיתי המשתמש יזוהה באמצעות Google Workspace.";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title={tip}
          className="flex items-center gap-2 h-8 px-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <div className="h-7 w-7 rounded-full bg-brand text-brand-foreground flex items-center justify-center text-[11px] font-semibold">
            {user.initials}
          </div>
          <div className="text-right leading-tight">
            <div className="text-[11px] font-medium text-foreground">{user.name}</div>
            <div className="text-[9.5px] text-muted-foreground">משתמש פעיל</div>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
          החלפת משתמש פעיל
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {users.map((u) => {
          const active = u.name === user.name;
          return (
            <DropdownMenuItem
              key={u.name}
              onClick={() => setUser(u)}
              className="text-[12px] flex items-center gap-2"
            >
              <div className="h-6 w-6 rounded-full bg-brand/10 text-brand flex items-center justify-center text-[10px] font-semibold">
                {u.initials}
              </div>
              <span className="flex-1 text-right">{u.name}</span>
              {active && <Check className="h-3.5 w-3.5 text-brand" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[10.5px] text-muted-foreground leading-snug flex gap-1.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{tip}</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
