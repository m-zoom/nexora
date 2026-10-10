import type { Metadata } from "next";
import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import ProductsView from "@/components/ProductsView";
import { getProducts } from "@/lib/api";
import { categories, isCategory } from "@/lib/products";

export const metadata: Metadata = {
  title: "Shop",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const params = await searchParams;
  const q = (first(params.q) ?? "").trim().slice(0, 80);
  const rawCategory = first(params.category);
  const category = isCategory(rawCategory) ? rawCategory : undefined;

  const results = await getProducts({ category, q });

  const chipHref = (slug?: string) => {
    const sp = new URLSearchParams();
    if (slug) sp.set("category", slug);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return s ? `/shop?${s}` : "/shop";
  };

  const chip = (active: boolean) =>
    `inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-[13px] transition-colors ${
      active ? "border-ink bg-ink text-white" : "border-line text-muted hover:border-ink hover:text-ink"
    }`;

  return (
    <section className="shell pt-10 md:pt-14">
      <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">Shop</h1>
      <p className="mt-1.5 text-sm text-muted">
        {q ? (
          <>
            {results.length} {results.length === 1 ? "result" : "results"} for “{q}”
            {" · "}
            <Link href={chipHref(category)} className="text-ink underline underline-offset-2">
              Clear search
            </Link>
          </>
        ) : (
          "Everyday essentials, trendy picks, and must-haves."
        )}
      </p>

      <nav
        id="categories"
        aria-label="Categories"
        className="-mx-4 mt-6 scroll-mt-24 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 md:mt-8"
      >
        <ul className="flex gap-2">
          <li>
            <Link href={chipHref()} className={chip(!category)} aria-current={!category ? "page" : undefined}>
              All
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={chipHref(c.slug)}
                className={chip(category === c.slug)}
                aria-current={category === c.slug ? "page" : undefined}
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        <ProductsView>
          {results.length ? (
            <ProductGrid key={`${category ?? "all"}-${q}`} products={results} />
          ) : (
            <div className="rounded-md bg-surface px-6 py-16 text-center">
              <p className="text-[15px] font-medium">No products found</p>
              <p className="mt-1 text-sm text-muted">Try a different search or category.</p>
              <Link
                href="/shop"
                className="mt-5 inline-flex rounded-md bg-ink px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
              >
                View all products
              </Link>
            </div>
          )}
        </ProductsView>
      </div>
    </section>
  );
}
