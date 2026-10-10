"use client";

import { useSyncExternalStore } from "react";
import type { Product } from "./products";

// Each line keeps a snapshot of the product, so the cart renders without
// another trip to the API (and survives a product leaving the catalogue).
export type CartItem = Pick<Product, "id" | "name" | "price" | "image"> & { qty: number };

const STORAGE_KEY = "nexora-cart-v2";
const EMPTY: CartItem[] = [];

let items: CartItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isItem(i: unknown): i is CartItem {
  const v = i as CartItem;
  return (
    typeof v?.id === "string" &&
    typeof v.name === "string" &&
    typeof v.image === "string" &&
    Number.isFinite(v.price) &&
    Number.isInteger(v.qty) &&
    v.qty > 0
  );
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) items = parsed.filter(isItem);
  } catch {
    items = EMPTY;
  }
}

function commit(next: CartItem[]) {
  items = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode); the cart still works in memory.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    loaded = false;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return items;
}

export function useCart() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export function addToCart(product: Product) {
  load();
  const existing = items.find((i) => i.id === product.id);
  commit(
    existing
      ? items.map((i) => (i.id === product.id ? { ...i, qty: Math.min(99, i.qty + 1) } : i))
      : [...items, { id: product.id, name: product.name, price: product.price, image: product.image, qty: 1 }],
  );
}

export function setQty(id: string, qty: number) {
  load();
  commit(
    qty <= 0
      ? items.filter((i) => i.id !== id)
      : items.map((i) => (i.id === id ? { ...i, qty } : i)),
  );
}

export function removeFromCart(id: string) {
  setQty(id, 0);
}

export function cartCount(list: CartItem[]) {
  return list.reduce((n, i) => n + i.qty, 0);
}

export function cartTotal(list: CartItem[]) {
  return list.reduce((sum, i) => sum + i.price * i.qty, 0);
}
