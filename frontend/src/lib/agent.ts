"use client";

import { useSyncExternalStore } from "react";
import { addToCart } from "./cart";
import type { Product } from "./products";

// What the voice agent has put on screen. While set, the product grids show
// exactly this list, numbered, so "the first and the third" match up.
export type Picks = { title: string; products: Product[]; version: number };

let picks: Picks | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setPicks(title: string, products: Product[]) {
  picks = { title, products, version: ++version };
  emit();
}

export function clearPicks() {
  picks = null;
  emit();
}

export function getPicks() {
  return picks;
}

export function useAgentPicks() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => picks,
    () => null,
  );
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Each product pops out of its card and arcs into the cart button, one
 * after another; it lands in the cart as its flight ends.
 */
export function flyToCart(products: Product[]) {
  const target = document.getElementById("cart-button");

  products.forEach((product, i) => {
    window.setTimeout(async () => {
      const card = document.querySelector<HTMLElement>(`[data-fly-id="${CSS.escape(product.id)}"]`);
      const img = card?.querySelector("img");
      if (!card || !img || !target || reducedMotion()) {
        addToCart(product);
        return;
      }

      const from = card.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);

      // A clone reuses the card's already-loaded image.
      const ghost = img.cloneNode() as HTMLImageElement;
      ghost.removeAttribute("loading");
      ghost.alt = "";
      ghost.className = "";
      Object.assign(ghost.style, {
        inset: "auto",
        boxSizing: "border-box",
        color: "transparent",
        position: "fixed",
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        objectFit: "contain",
        padding: `${from.width * 0.07}px`,
        background: "#fff",
        borderRadius: "10px",
        zIndex: "80",
        pointerEvents: "none",
        willChange: "transform, opacity",
      });
      document.body.appendChild(ghost);
      await ghost.decode().catch(() => {});

      // The card answers with a soft press while its product lifts off.
      card.animate(
        [{ transform: "scale(1)" }, { transform: "scale(0.94)" }, { transform: "scale(1)" }],
        { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );

      const flight = ghost.animate(
        [
          { transform: "translate(0, 0) scale(1)", boxShadow: "0 0 0 rgba(0,0,0,0)", offset: 0 },
          { transform: "translate(0, -18px) scale(1.08)", boxShadow: "0 22px 40px -14px rgba(0,0,0,0.28)", offset: 0.2 },
          {
            transform: `translate(${dx * 0.45}px, ${Math.min(dy, 0) * 0.35 - 110}px) scale(0.5)`,
            boxShadow: "0 18px 30px -12px rgba(0,0,0,0.22)",
            offset: 0.58,
          },
          { transform: `translate(${dx}px, ${dy}px) scale(0.06)`, boxShadow: "0 0 0 rgba(0,0,0,0)", opacity: 0.7, offset: 1 },
        ],
        { duration: 1150, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" },
      );

      flight.onfinish = () => {
        ghost.remove();
        addToCart(product);
        target.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.22) rotate(-8deg)" }, { transform: "scale(1)" }],
          { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      };
    }, i * 220);
  });
}
