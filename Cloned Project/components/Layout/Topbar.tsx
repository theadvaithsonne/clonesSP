import Link from "next/link";

export default function Topbar() {
  return (
    <header className="glass-pro sticky top-0 z-20 w-full">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm tracking-widest text-[var(--muted-foreground)]"
        >
          TEAM • ONBOARDING
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Dashboard
          </Link>
          <Link
            href="/login"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
