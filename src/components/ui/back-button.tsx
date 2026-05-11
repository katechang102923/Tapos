"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton({ fallback = "/", label = "返回" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }
  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-black text-steel shadow-sm hover:text-ink"
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  );
}
