"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/search", label: "Search" },
  { href: "/orders", label: "Order list" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 bg-paper/80 backdrop-blur-md border-b border-line">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
        {/* Logo / wordmark — editorial */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="relative flex items-center justify-center w-7 h-7 bg-ink text-paper rounded font-serif font-bold text-sm">
            E
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sienna" />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-serif text-[17px] font-semibold tracking-tight leading-none">
              Inventory
            </span>
            <span className="text-[10px] font-medium tracking-editorial uppercase text-ink-faint hidden sm:inline">
              India · INR
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-3 py-1.5 rounded-md transition-colors",
                  active
                    ? "text-ink font-medium"
                    : "text-ink-faint hover:text-ink",
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sienna" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-2xs tracking-editorial uppercase text-ink-faint">
            <span className="relative flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-sage" />
              <span className="absolute inset-0 -m-1 rounded-full bg-sage opacity-30 animate-pulse-dot" />
            </span>
            Live prices
          </div>
          <Link
            href="/admin"
            className="text-xs font-medium text-ink-soft hover:text-ink border border-line rounded-md px-3 py-1.5 hover:border-line-strong transition-colors"
          >
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}
