"use client";

import Link from "next/link";
import clsx from "clsx";

export type PageTab = { id: string; label: string };

export function PageTabs({
  tabs,
  activeTab,
  basePath,
  query,
}: {
  tabs: PageTab[];
  activeTab: string;
  basePath: string;
  query?: Record<string, string | number | null | undefined>;
}) {
  function hrefFor(tabId: string) {
    const params = new URLSearchParams();
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value != null && value !== "") params.set(key, String(value));
      }
    }
    if (tabId !== tabs[0]?.id) {
      params.set("tab", tabId);
    } else {
      params.delete("tab");
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 mb-4">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={hrefFor(tab.id)}
            className={clsx(
              "px-3 py-2 text-[12.5px] font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
