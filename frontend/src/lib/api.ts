import "server-only";
import type { Product } from "./products";

// Read at request time, so one build works against any backend.
export function apiUrl() {
  return (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

export async function getProducts(params: { category?: string; q?: string } = {}): Promise<Product[]> {
  const sp = new URLSearchParams();
  if (params.category) sp.set("category", params.category);
  if (params.q) sp.set("q", params.q);
  try {
    const res = await fetch(`${apiUrl()}/api/products?${sp}`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    return (await res.json()) as Product[];
  } catch {
    return [];
  }
}
