import Link from "next/link";
import Hero from "@/components/Hero";
import ProductGrid from "@/components/ProductGrid";
import ProductsView from "@/components/ProductsView";
import { ArrowRightIcon } from "@/components/icons";
import { getProducts } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getProducts();

  return (
    <>
      <Hero />

      <section id="products" aria-labelledby="featured-heading" className="shell scroll-mt-20 pt-12 md:pt-16">
        <div className="mb-6 flex items-center justify-between gap-4 md:mb-8">
          <h2 id="featured-heading" className="text-xl font-semibold tracking-tight md:text-2xl">
            Featured Products
          </h2>
          <Link
            href="/shop"
            className="group inline-flex shrink-0 items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            View All
            <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <ProductsView>
          {products.length ? (
            <ProductGrid products={products} />
          ) : (
            <p className="rounded-md bg-surface px-6 py-16 text-center text-sm text-muted">
              Products are loading slowly right now. Please refresh in a moment.
            </p>
          )}
        </ProductsView>
      </section>
    </>
  );
}
