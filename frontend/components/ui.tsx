import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "bg-white border border-slate-200 rounded-lg shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4 gap-4">
      <div>
        <h1 className="text-[18px] font-bold text-navy tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

const toneMap = {
  default: "text-slate-800",
  good: "text-risk-low",
  warn: "text-risk-medium",
  bad: "text-risk-critical",
} as const;

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: keyof typeof toneMap;
}) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={clsx("text-[22px] font-bold tabular-nums mt-1", toneMap[tone])}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
    </Card>
  );
}

const statusStyles: Record<string, string> = {
  Active: "bg-green-50 text-risk-low border-green-200",
  "In Review": "bg-amber-50 text-amber-700 border-amber-200",
  Quoting: "bg-brand-soft text-brand border-brand/30",
  Archived: "bg-slate-100 text-slate-500 border-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  const labelHe: Record<string, string> = {
    Active: "פעיל",
    "In Review": "בבדיקה",
    Quoting: "בתמחור",
    Archived: "בארכיון",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium",
        statusStyles[status] ?? "bg-slate-100 text-slate-600 border-slate-200",
      )}
    >
      {labelHe[status] ?? status}
    </span>
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}
