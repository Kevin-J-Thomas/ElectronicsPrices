"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  Clock,
  History,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/sites", label: "Sites", icon: Globe },
  { href: "/admin/schedule", label: "Scheduler", icon: Clock },
  { href: "/admin/runs", label: "Run History", icon: History },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-console-bg">
      {/* Sidebar */}
      <aside className="w-64 bg-console-bg border-r border-console-line flex flex-col fixed h-screen">
        {/* Logo block */}
        <div className="px-5 py-5 border-b border-console-line">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="relative flex items-center justify-center w-8 h-8 bg-console-panel border border-console-line rounded text-console-ink font-serif font-bold text-sm">
              E
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-sienna" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-serif text-[15px] font-semibold text-console-ink">
                Inventory
              </span>
              <span className="text-2xs tracking-editorial uppercase text-console-faint">
                Admin Console
              </span>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          <div className="px-3 mb-2">
            <span className="text-2xs font-semibold tracking-editorial uppercase text-console-faint">
              Manage
            </span>
          </div>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 mb-0.5",
                  active
                    ? "bg-console-active text-console-ink"
                    : "text-console-muted hover:bg-console-hover hover:text-console-ink",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-sienna rounded-r" />
                )}
                <Icon size={15} strokeWidth={1.75} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-console-line p-4 space-y-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-console-muted hover:text-console-ink transition-colors"
          >
            <ArrowLeft size={12} />
            Back to public site
            <ExternalLink size={10} className="ml-auto" />
          </Link>
          <div className="flex items-center gap-2 text-2xs text-console-faint">
            <span className="relative flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-sage" />
              <span className="absolute inset-0 -m-1 rounded-full bg-sage opacity-30 animate-pulse-dot" />
            </span>
            <span className="tracking-editorial uppercase">API connected</span>
          </div>
        </div>
      </aside>

      {/* Main content — with offset for fixed sidebar */}
      <div className="flex-1 ml-64 min-h-screen bg-console-bg">
        <div className="bg-paper min-h-screen border-l border-console-line">
          <main className="px-8 py-10 max-w-6xl">{children}</main>
        </div>
      </div>
    </div>
  );
}
