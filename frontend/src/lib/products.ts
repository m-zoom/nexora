export type Category = "phones" | "audio" | "wearables" | "bags" | "shoes";

export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: Category;
  description?: string;
};

export const categories: { slug: Category; label: string }[] = [
  { slug: "phones", label: "Phones" },
  { slug: "audio", label: "Audio" },
  { slug: "wearables", label: "Wearables" },
  { slug: "bags", label: "Bags" },
  { slug: "shoes", label: "Shoes" },
];

export function isCategory(value: string | undefined): value is Category {
  return categories.some((c) => c.slug === value);
}

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number) {
  return naira.format(value);
}
