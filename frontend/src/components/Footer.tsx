import Link from "next/link";
import { categories } from "@/lib/products";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="shell grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4">
        <div id="about" className="col-span-2 scroll-mt-24 md:col-span-2 md:max-w-sm">
          <Link href="/" className="text-xl font-medium tracking-tight">
            Nexora
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Nexora curates quality everyday tech and accessories — thoughtfully chosen, fairly
            priced, and delivered across Nigeria.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium">Shop</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-muted">
            <li>
              <Link href="/shop" className="transition-colors hover:text-ink">
                All products
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/shop?category=${c.slug}`}
                  className="transition-colors hover:text-ink"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div id="contact" className="scroll-mt-24">
          <h2 className="text-sm font-medium">Contact</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-muted">
            <li>
              <a href="mailto:hello@nexora.ng" className="break-all transition-colors hover:text-ink">
                hello@nexora.ng
              </a>
            </li>
            <li>
              <a href="tel:+2348000000000" className="transition-colors hover:text-ink">
                +234 800 000 0000
              </a>
            </li>
            <li>Lagos, Nigeria</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <p className="shell py-5 text-xs text-muted">
          © {new Date().getFullYear()} Nexora. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
