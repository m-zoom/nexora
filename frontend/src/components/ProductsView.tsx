"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { clearPicks, useAgentPicks } from "@/lib/agent";
import ProductGrid from "./ProductGrid";

/** The page's own products, or, while the voice agent is showing some, exactly those. */
export default function ProductsView({ children }: { children: ReactNode }) {
  const picks = useAgentPicks();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (picks) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [picks]);

  if (!picks) return <>{children}</>;

  return (
    <div ref={ref} className="scroll-mt-24">
      <div className="mb-6 flex animate-fade-up items-center justify-between gap-4 rounded-lg bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-ink/40" />
            <span className="relative h-2 w-2 rounded-full bg-ink" />
          </span>
          <p className="truncate text-[13px]">
            <span className="text-muted">Picked for you · </span>
            <span className="font-medium">{picks.title}</span>
            <span className="text-muted"> ({picks.products.length})</span>
          </p>
        </div>
        <button
          type="button"
          onClick={clearPicks}
          className="shrink-0 text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Show all
        </button>
      </div>
      <ProductGrid key={picks.version} products={picks.products} numbered />
    </div>
  );
}
