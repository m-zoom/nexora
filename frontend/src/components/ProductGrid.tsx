import type { Product } from "@/lib/products";
import ProductCard from "./ProductCard";

export default function ProductGrid({ products, numbered = false }: { products: Product[]; numbered?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-6">
      {products.map((product, i) => (
        <li
          key={product.id}
          className="animate-fade-up"
          style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
        >
          <ProductCard product={product} number={numbered ? i + 1 : undefined} />
        </li>
      ))}
    </ul>
  );
}
