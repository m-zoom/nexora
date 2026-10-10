"use client";

import Link from "next/link";
import Form from "next/form";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cartCount, useCart } from "@/lib/cart";
import CartDrawer from "./CartDrawer";
import { CartIcon, SearchIcon, UserIcon } from "./icons";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/shop#categories", label: "Categories" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

type Panel = "menu" | "search" | "account" | "cart" | null;

const iconBtn =
  "relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface";

export default function Header() {
  const pathname = usePathname();
  const cart = useCart();
  const count = cartCount(cart);
  const [panel, setPanel] = useState<Panel>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggle = (p: Exclude<Panel, null>) =>
    setPanel((cur) => (cur === p ? null : p));
  const close = () => setPanel(null);

  // Escape closes whatever is open.
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  // Lock page scroll while the mobile menu or cart drawer is open.
  useEffect(() => {
    if (panel !== "menu" && panel !== "cart") return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [panel]);

  // The mobile menu makes no sense once the desktop nav is visible.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () =>
      mq.matches && setPanel((cur) => (cur === "menu" ? null : cur));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Clicking outside the account popover closes it.
  useEffect(() => {
    if (panel !== "account") return;
    const onDown = (e: PointerEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setPanel(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [panel]);

  useEffect(() => {
    if (panel === "search") searchInputRef.current?.focus();
  }, [panel]);

  const isActive = (href: string) =>
    (href === "/" && pathname === "/") || (href === "/shop" && pathname === "/shop");

  const menuOpen = panel === "menu";
  const searchOpen = panel === "search";

  return (
    <>
      <header className="sticky top-0 z-50 bg-white">
        <div className="shell relative z-10 grid h-16 grid-cols-[1fr_auto] items-center md:h-[72px] md:grid-cols-[1fr_auto_1fr]">
          <Link
            href="/"
            onClick={close}
            className="justify-self-start text-[22px] font-medium tracking-tight md:text-2xl"
          >
            Nexora
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-8 lg:gap-10">
              {NAV.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`relative py-2 text-sm transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[1.5px] after:origin-left after:bg-ink after:transition-transform after:duration-300 ${
                      isActive(item.href)
                        ? "text-ink after:scale-x-100"
                        : "text-muted after:scale-x-0 hover:text-ink hover:after:scale-x-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Actions */}
          <div className="flex items-center justify-self-end gap-0.5 sm:gap-1.5">
            <button
              type="button"
              aria-label={searchOpen ? "Close search" : "Search"}
              aria-expanded={searchOpen}
              aria-controls="site-search"
              onClick={() => toggle("search")}
              className={iconBtn}
            >
              <SearchIcon className="h-[22px] w-[22px]" />
            </button>

            <div ref={accountRef} className="relative hidden md:block">
              <button
                type="button"
                aria-label="Account"
                aria-expanded={panel === "account"}
                aria-controls="account-popover"
                onClick={() => toggle("account")}
                className={iconBtn}
              >
                <UserIcon className="h-[22px] w-[22px]" />
              </button>
              <div
                id="account-popover"
                inert={panel !== "account"}
                className={`absolute right-0 top-full mt-2 w-64 origin-top-right rounded-lg border border-line bg-white p-4 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)] transition duration-200 ease-smooth ${
                  panel === "account"
                    ? "scale-100 opacity-100"
                    : "pointer-events-none scale-95 opacity-0"
                }`}
              >
                <AccountNote />
              </div>
            </div>

            <button
              id="cart-button"
              type="button"
              aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
              onClick={() => setPanel("cart")}
              className={iconBtn}
            >
              <CartIcon className="h-[22px] w-[22px]" />
              <span
                key={count}
                className={`absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-none text-white ${
                  count ? "animate-bump" : ""
                }`}
              >
                {count > 99 ? "99+" : count}
              </span>
            </button>

            {/* Mobile menu toggle */}
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => toggle("menu")}
              className={`${iconBtn} md:hidden`}
            >
              <span className="relative block h-3.5 w-5">
                <span
                  className={`absolute left-0 top-0 h-[1.5px] w-5 rounded bg-ink transition-transform duration-300 ease-smooth ${
                    menuOpen ? "translate-y-[6.25px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`absolute left-0 top-[6.25px] h-[1.5px] w-5 rounded bg-ink transition-opacity duration-200 ${
                    menuOpen ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 top-[12.5px] h-[1.5px] w-5 rounded bg-ink transition-transform duration-300 ease-smooth ${
                    menuOpen ? "-translate-y-[6.25px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Search panel */}
        <div
          id="site-search"
          inert={!searchOpen}
          className={`absolute inset-x-0 top-full z-10 grid border-b border-line bg-white transition-[grid-template-rows,opacity] duration-300 ease-smooth ${
            searchOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] border-transparent opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <Form action="/shop" onSubmit={close} className="shell flex items-center gap-3 py-4">
              <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
              <label htmlFor="q" className="sr-only">
                Search products
              </label>
              <input
                ref={searchInputRef}
                id="q"
                name="q"
                type="search"
                placeholder="Search products…"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted/80"
              />
              <button
                type="submit"
                className="shrink-0 rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
              >
                Search
              </button>
            </Form>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          id="mobile-menu"
          inert={!menuOpen}
          className={`absolute inset-x-0 top-full z-10 grid bg-white transition-[grid-template-rows] duration-[400ms] ease-smooth md:hidden ${
            menuOpen ? "grid-rows-[1fr] border-b border-line" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <nav aria-label="Mobile" className="shell pb-6 pt-2">
              <ul>
                {NAV.map((item, i) => (
                  <li
                    key={item.label}
                    style={{ transitionDelay: menuOpen ? `${80 + i * 40}ms` : "0ms" }}
                    className={`border-b border-line transition duration-300 ease-smooth ${
                      menuOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                    }`}
                  >
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={`flex items-center justify-between py-3.5 text-[15px] ${
                        isActive(item.href) ? "font-medium text-ink" : "text-muted"
                      }`}
                    >
                      {item.label}
                      {isActive(item.href) && (
                        <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              <div
                style={{ transitionDelay: menuOpen ? `${80 + NAV.length * 40}ms` : "0ms" }}
                className={`mt-5 flex items-start gap-3 rounded-lg bg-surface p-4 transition duration-300 ease-smooth ${
                  menuOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                }`}
              >
                <UserIcon className="mt-0.5 h-5 w-5 shrink-0" />
                <AccountNote />
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Backdrop for mobile menu and search */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-300 ${
          menuOpen || searchOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <CartDrawer open={panel === "cart"} onClose={close} />
    </>
  );
}

function AccountNote() {
  return (
    <div>
      <p className="text-sm font-medium">Accounts are coming soon</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        You can shop as a guest. Your cart is saved on this device.
      </p>
    </div>
  );
}
