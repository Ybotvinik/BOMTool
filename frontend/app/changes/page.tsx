"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ChangesRedirectInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "changes");
    router.replace(`/versions?${next.toString()}`);
  }, [router, params]);

  return <div className="py-12 text-center text-slate-500 text-[13px]">מעביר לגרסאות...</div>;
}

export default function ChangesPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <ChangesRedirectInner />
    </Suspense>
  );
}
