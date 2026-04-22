"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  Clock,
  History,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  Package,
  Layers,
} from "lucide-react";
import { Chip } from "@heroui/react";

const NAV_SECTIONS = [
  {
    title: "Manage",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/sites", label: "Sites", icon: Globe },
      { href: "/admin/schedule", label: "Scheduler", icon: Clock },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/admin/listings", label: "Listings", icon: Package },
      { href: "/admin/products", label: "Products", icon: Layers },
      { href: "/admin/runs", label: "Run History", icon: History },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="dark min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 bg-background border-r border-divider flex flex-col fixed h-screen">
        {/* Brand block */}
        <NextLink
          href="/"
          className="flex items-center gap-3 px-5 py-5 border-b border-divider group hover:bg-content1 transition-colors"
        >
          <span className="relative flex items-center justify-center w-9 h-9 bg-content2 border border-divider rounded-md font-serif text-[18px] text-foreground shadow-sm">
            E
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-[17px] text-foreground">Inventory</span>
            <span className="text-[10px] tracking-[0.16em] uppercase text-default-500 font-medium">
              Admin Console
            </span>
          </div>
        </NextLink>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-6">
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-default-400">
                  {section.title}
                </span>
                <span className="text-[10px] text-default-400 num">
                  {String(section.items.length).padStart(2, "0")}
                </span>
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <NextLink
                        href={item.href}
                        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all ${
                          active
                            ? "bg-content2 text-foreground"
                            : "text-default-500 hover:bg-content1 hover:text-foreground"
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-primary rounded-r-full" />
                        )}
                        <Icon
                          size={16}
                          strokeWidth={active ? 2 : 1.75}
                          className={`shrink-0 transition-colors ${
                            active ? "text-primary" : "text-default-400 group-hover:text-default-600"
                          }`}
                        />
                        <span className={active ? "font-medium" : ""}>{item.label}</span>
                        {active && (
                          <ChevronRight size={14} className="ml-auto text-default-400" />
                        )}
                      </NextLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-divider px-4 py-4 space-y-3">
          <NextLink
            href="/"
            className="flex items-center gap-2 text-xs text-default-500 hover:text-foreground transition-colors group"
          >
            <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
            Back to public site
            <ExternalLink size={10} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </NextLink>

          <div className="flex items-center justify-between pt-2 border-t border-divider/60">
            <Chip
              size="sm"
              variant="dot"
              color="success"
              className="text-[10px] tracking-[0.14em] uppercase border-none h-auto px-0"
            >
              <span className="text-default-500 font-medium">API connected</span>
            </Chip>
            <span className="text-[10px] num text-default-400">v0.1</span>
          </div>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 ml-64 min-h-screen bg-content1">
        <main className="px-8 py-10 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
