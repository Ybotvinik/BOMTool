"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function QualityRedirectInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "quality");
    router.replace(`/bom?${next.toString()}`);
  }, [router, params]);

  return <div className="py-12 text-center text-slate-500 text-[13px]">מעביר לטבלת BOM...</div>;
}

export default function QualityPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-[13px]">טוען...</div>}>
      <QualityRedirectInner />
    </Suspense>
  );
}
