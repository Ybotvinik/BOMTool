import {
  FolderKanban,
  LayoutDashboard,
  Table2,
  DollarSign,
  GitBranch,
  FileDown,
  ShoppingCart,
  Files,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

/** Legacy routes that should highlight a parent nav item. */
export const NAV_ACTIVE_ALIASES: Record<string, string[]> = {
  "/bom": ["/quality"],
  "/versions": ["/changes"],
  "/official-pricing": ["/china-quote", "/supplier-pricing"],
};

// Sidebar order matches the product spec (Hebrew labels, RTL).
export const NAV_ITEMS: NavItem[] = [
  { label: "פרויקטים", href: "/projects", icon: FolderKanban },
  { label: "סקירת פרויקט", href: "/project", icon: LayoutDashboard },
  { label: "טבלת BOM", href: "/bom", icon: Table2 },
  { label: "מחירון BOM מספקים", href: "/official-pricing", icon: DollarSign },
  { label: "גרסאות", href: "/versions", icon: GitBranch },
  { label: "דוחות וייצוא", href: "/export", icon: FileDown },
  { label: "קובץ רכש לספק", href: "/procurement-file", icon: ShoppingCart },
  { label: "קבצי פרויקט", href: "/files", icon: Files },
  { label: "יומן פעולות", href: "/activity", icon: History },
  { label: "הגדרות", href: "/settings", icon: Settings },
];
