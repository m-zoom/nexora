import Link from "next/link";

export default function NotFound() {
  return (
    <section className="shell flex flex-col items-center py-24 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted">The page you’re looking for doesn’t exist.</p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-ink px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
      >
        Back to home
      </Link>
    </section>
  );
}
