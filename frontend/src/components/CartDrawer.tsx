"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cartCount, cartTotal, removeFromCart, setQty, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";
import { CloseIcon, MinusIcon, PlusIcon } from "./icons";

type Props = { open: boolean; onClose: () => void };

export default function CartDrawer({ open, onClose }: Props) {
  const cart = useCart();
  const count = cartCount(cart);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState(false);

  // Move focus into the drawer, and give it back when it closes.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      previous?.focus();
      setNotice(false);
    };
  }, [open]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        inert={!open}
        className={`fixed inset-y-0 right-0 z-[70] flex w-full max-w-[380px] flex-col bg-white transition-[transform,visibility,box-shadow] duration-[400ms] ease-smooth ${
          open
            ? "visible translate-x-0 shadow-[-12px_0_40px_-16px_rgba(0,0,0,0.25)]"
            : "invisible translate-x-full shadow-none"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <h2 className="text-base font-medium">
            Your Cart <span className="text-muted">({count})</span>
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-surface"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="text-[15px] font-medium">Your cart is empty</p>
            <p className="mt-1 text-sm text-muted">Add a few favourites to get started.</p>
            <Link
              href="/shop"
              onClick={onClose}
              className="mt-5 rounded-md bg-ink px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto overscroll-contain px-5">
              {cart.map((item) => {
                return (
                  <li key={item.id} className="flex gap-3.5 py-4">
                    <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md bg-surface">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="72px"
                        className="object-contain p-2 mix-blend-multiply"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm">{item.name}</p>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="shrink-0 text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <p className="mt-0.5 text-sm font-medium">{formatPrice(item.price)}</p>
                      <div className="mt-auto flex w-fit items-center rounded-md border border-line">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${item.name}`}
                          onClick={() => setQty(item.id, item.qty - 1)}
                          className="inline-flex h-7 w-7 items-center justify-center hover:bg-surface"
                        >
                          <MinusIcon className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-[13px] tabular-nums" aria-live="polite">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.name}`}
                          onClick={() => setQty(item.id, item.qty + 1)}
                          disabled={item.qty >= 99}
                          className="inline-flex h-7 w-7 items-center justify-center hover:bg-surface disabled:opacity-40"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-line px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="text-base font-medium">{formatPrice(cartTotal(cart))}</span>
              </div>
              <p className="mt-1 text-xs text-muted">Shipping calculated at checkout.</p>
              <button
                type="button"
                onClick={() => setNotice(true)}
                className="mt-4 h-11 w-full rounded-md bg-ink text-sm font-medium text-white transition-opacity hover:opacity-85"
              >
                Checkout
              </button>
              <p
                role="status"
                className={`overflow-hidden text-center text-xs text-muted transition-all duration-300 ${
                  notice ? "mt-3 max-h-10 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                Online payment isn&apos;t connected yet — we&apos;ll be live soon.
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
