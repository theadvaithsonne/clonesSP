"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/coverfi/products", label: "Products" },
  { href: "/coverfi/products/categories", label: "Categories" },
  { href: "/coverfi/products/filters", label: "Filters" },
];

export default function ProductsTabs() {
  const pathname = usePathname() || "";
  return (
    <div className="border-b border-white/5 px-8">
      <nav className="flex gap-1">
        {tabs.map((t) => {
          // "Products" tab matches /products itself plus any deep product
          // page (e.g. /products/[id], /products/new) but NOT the sibling
          // tabs /categories or /filters.
          const active =
            t.href === "/coverfi/products"
              ? pathname === t.href ||
                (pathname.startsWith("/coverfi/products/") &&
                  !pathname.startsWith("/coverfi/products/categories") &&
                  !pathname.startsWith("/coverfi/products/filters"))
              : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative px-4 py-3 text-sm transition-colors -mb-px",
                active
                  ? "text-white border-b-2 border-brand"
                  : "text-[#9fa0b8] hover:text-white border-b-2 border-transparent",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
