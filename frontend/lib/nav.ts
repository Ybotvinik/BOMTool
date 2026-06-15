import {
  FolderKanban,
  LayoutDashboard,
  Table2,
  Upload,
  ShieldCheck,
  DollarSign,
  Users,
  GitBranch,
  GitCompare,
  FileDown,
  ShoppingCart,
  Files,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

// Sidebar order matches the product spec (Hebrew labels, RTL).
export const NAV_ITEMS: NavItem[] = [
  { label: "פרויקטים", href: "/projects", icon: FolderKanban },
  { label: "סקירת פרויקט", href: "/project", icon: LayoutDashboard },
  { label: "טבלת BOM", href: "/bom", icon: Table2 },
  { label: "טעינת BOM", href: "/upload-bom", icon: Upload },
  { label: "איכות BOM", href: "/quality", icon: ShieldCheck },
  { label: "מחירון סין", href: "/china-quote", icon: DollarSign },
  { label: "נציגים רשמיים", href: "/rep-quote", icon: Users },
  { label: "גרסאות", href: "/versions", icon: GitBranch },
  { label: "השוואת שינויים", href: "/changes", icon: GitCompare },
  { label: "דוחות וייצוא", href: "/export", icon: FileDown },
  { label: "קובץ רכש לספק", href: "/procurement-file", icon: ShoppingCart },
  { label: "קבצי פרויקט", href: "/files", icon: Files },
  { label: "יומן פעולות", href: "/activity", icon: History },
  { label: "הגדרות", href: "/settings", icon: Settings },
];
