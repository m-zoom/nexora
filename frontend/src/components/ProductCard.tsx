"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { addToCart } from "@/lib/cart";
import { formatPrice, type Product } from "@/lib/products";
import { CheckIcon } from "./icons";

export default function ProductCard({ product, number }: { product: Product; number?: number }) {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleAdd = () => {
    addToCart(product);
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article className="group flex flex-col">
      <div data-fly-id={product.id} className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1200px) 220px, (min-width: 1024px) 19vw, (min-width: 768px) 23vw, 46vw"
          className="object-contain p-[7%] mix-blend-multiply transition-transform duration-500 ease-smooth group-hover:scale-[1.04]"
        />
        {number !== undefined && (
          <span className="absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-semibold text-white">
            {number}
          </span>
        )}
      </div>

      <h3 className="mt-3 truncate text-[13px] sm:text-sm">{product.name}</h3>
      <p className="mt-1 text-[13px] font-medium sm:text-sm">{formatPrice(product.price)}</p>

      <button
        type="button"
        onClick={handleAdd}
        aria-label={`Add ${product.name} to cart`}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-ink text-xs font-medium text-white transition-[opacity,transform] hover:opacity-85 active:scale-[0.98] sm:text-[13px]"
      >
        <span aria-live="polite" className="inline-flex items-center gap-1.5">
          {added ? (
            <>
              <CheckIcon className="h-3.5 w-3.5" /> Added
            </>
          ) : (
            "Add to Cart"
          )}
        </span>
      </button>
    </article>
  );
}
