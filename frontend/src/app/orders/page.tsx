"use client";

import { useState } from "react";
import { Plus, X, ExternalLink, Calculator, CheckCircle2 } from "lucide-react";
import TopNav from "@/components/TopNav";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { cn, formatINR } from "@/lib/utils";

type OrderItem = {
  query: string;
  chosen_site: string;
  title: string;
  price: number;
  currency: string;
  link: string;
  score: number | null;
};

type LowestResult = {
  items: OrderItem[];
  total: number;
  currency: string;
  missing: string[];
};

type SiteEntry = {
  price: number;
  currency: string;
  link: string;
  title: string;
  score: number | null;
  condition: string;
};
type Coverage = Record<string, Record<string, SiteEntry>>;

const STARTER_ITEMS = ["Samsung SSD", "WD 1TB HDD", "AMD Ryzen 5"];

export default function OrdersPage() {
  const [items, setItems] = useState<string[]>(STARTER_ITEMS);
  const [lowest, setLowest] = useState<LowestResult | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(false);

  function updateItem(i: number, v: string) {
    setItems(items.map((x, idx) => (idx === i ? v : x)));
  }
  function addItem() {
    setItems([...items, ""]);
  }
  function removeItem(i: number) {
    if (items.length === 1) {
      setItems([""]);
      return;
    }
    setItems(items.filter((_, idx) => idx !== i));
  }

  async function generateOrder() {
    const payload = { items: items.map((s) => s.trim()).filter(Boolean) };
    if (payload.items.length === 0) return;
    setLoading(true);
    try {
      const [lRes, cRes] = await Promise.all([
        api.post("/orders/lowest-cost", payload),
        api.post("/orders/coverage", payload),
      ]);
      setLowest(lRes.data);
      setCoverage(cRes.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopNav />
      <main className="max-w-6xl mx-auto px-6 py-10 md:py-14">

        <section className="mb-10 animate-slide-up">
          <div className="eyebrow mb-3">Section 03 · Procurement</div>
          <h1 className="font-serif text-5xl font-semibold tracking-tight leading-[1.05]">
            Build a list.
            <br />
            <span className="italic text-sienna">We'll find the cheapest route.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-soft leading-relaxed">
            Enter what you're shopping for. The engine searches every site and returns the
            lowest-cost combination, plus a per-site coverage map.
          </p>
        </section>

        <div className="grid md:grid-cols-[1fr_auto] gap-6 mb-10 animate-slide-up-delay-1">
          {/* Builder */}
          <div className="card p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <div className="eyebrow">Your order list</div>
              <span className="num text-xs text-ink-faint">
                {items.filter((i) => i.trim()).length} / {items.length} items
              </span>
            </div>

            <div className="space-y-2 mb-5">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 group">
                  <span className="num text-xs text-ink-faint w-8 text-right">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    className="input"
                    value={item}
                    onChange={(e) => updateItem(i, e.target.value)}
                    placeholder="e.g. Samsung SSD 128GB Sata"
                  />
                  <button
                    onClick={() => removeItem(i)}
                    className="w-8 h-8 flex items-center justify-center rounded-md text-ink-faint hover:text-crimson hover:bg-crimson/5 transition-colors"
                    aria-label="Remove"
                    type="button"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-line">
              <button onClick={addItem} className="btn-ghost text-sm">
                <Plus size={14} />
                Add item
              </button>
              <button onClick={generateOrder} disabled={loading} className="btn-accent">
                <Calculator size={14} />
                {loading ? "Calculating…" : "Calculate cheapest"}
              </button>
            </div>
          </div>

          {/* Total summary card */}
          <div
            className={cn(
              "card p-8 w-full md:w-80 flex flex-col justify-center shadow-soft relative overflow-hidden",
              "bg-gradient-to-br from-surface to-sienna/5",
            )}
          >
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-sienna/10 blur-3xl" />
            <div className="relative">
              <div className="eyebrow mb-2">Cheapest total</div>
              {loading ? (
                <Skeleton className="h-14 w-40" />
              ) : lowest ? (
                <>
                  <div className="font-serif text-5xl font-semibold num tracking-tight text-ink">
                    {formatINR(lowest.total)}
                  </div>
                  <div className="mt-3 text-sm text-ink-soft">
                    across {new Set(lowest.items.map((i) => i.chosen_site)).size} sites · {lowest.items.length} items matched
                  </div>
                  {lowest.missing.length > 0 && (
                    <div className="mt-3 text-xs text-amber">
                      {lowest.missing.length} not found: {lowest.missing.join(", ")}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-ink-faint italic">— no total yet —</div>
              )}
            </div>
          </div>
        </div>

        {/* Breakdown */}
        {lowest && lowest.items.length > 0 && (
          <section className="mb-10 animate-fade-in">
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="eyebrow mb-1 flex items-center gap-2">
                  <CheckCircle2 size={10} className="text-sage" />
                  Cheapest pick per item
                </div>
                <h2 className="font-serif text-2xl font-semibold tracking-tight">
                  Your winning combination
                </h2>
              </div>
            </div>
            <div className="card overflow-hidden shadow-soft">
              <table className="table-refined">
                <thead>
                  <tr>
                    <th className="w-12 text-right">#</th>
                    <th>Request</th>
                    <th>Matched</th>
                    <th className="w-28">Site</th>
                    <th className="w-24">Score</th>
                    <th className="w-28 text-right">Price</th>
                    <th className="w-16 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {lowest.items.map((it, i) => (
                    <tr key={i} className="group">
                      <td className="num text-xs text-ink-faint text-right">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="font-medium text-ink">{it.query}</td>
                      <td className="text-sm text-ink-soft">
                        <span className="line-clamp-1">{it.title}</span>
                      </td>
                      <td>
                        <span className="text-2xs tracking-editorial uppercase text-ink-soft">
                          {it.chosen_site}
                        </span>
                      </td>
                      <td><ScoreBadge score={it.score} variant="compact" /></td>
                      <td className="num text-right font-semibold text-ink">
                        {formatINR(it.price)}
                      </td>
                      <td className="text-right">
                        <a
                          href={it.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-ink-faint group-hover:text-sienna"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-paper/60">
                    <td colSpan={5} className="text-right eyebrow text-ink">
                      Total
                    </td>
                    <td className="num text-right font-serif text-xl font-semibold">
                      {formatINR(lowest.total)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Coverage per-site (spec-compliant) */}
        {coverage && (
          <section className="animate-fade-in">
            <div className="eyebrow mb-2">Per-spec evaluation</div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight mb-1">
              Coverage across sites
            </h2>
            <p className="text-sm text-ink-soft mb-6">
              Every site that stocks each item, with price + score + link.
            </p>

            <div className="space-y-6">
              {Object.entries(coverage).map(([query, sites]) => {
                const siteList = Object.entries(sites);
                return (
                  <div key={query} className="card overflow-hidden">
                    <div className="px-5 py-3 border-b border-line flex items-center justify-between bg-paper/40">
                      <h3 className="font-serif text-lg font-semibold italic">{query}</h3>
                      <span className="text-2xs tracking-editorial uppercase text-ink-faint">
                        {siteList.length} site{siteList.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {siteList.length === 0 ? (
                      <div className="px-5 py-6 text-sm text-ink-faint italic">
                        No site stocks this.
                      </div>
                    ) : (
                      <table className="table-refined">
                        <tbody>
                          {siteList
                            .sort((a, b) => a[1].price - b[1].price)
                            .map(([site, entry], i) => (
                              <tr key={site} className="group">
                                <td className="w-32">
                                  <span className="text-2xs tracking-editorial uppercase text-ink-soft">
                                    {site}
                                  </span>
                                </td>
                                <td className="w-28 num font-semibold">
                                  {formatINR(entry.price)}
                                  {i === 0 && (
                                    <span className="ml-2 text-2xs text-sage tracking-editorial uppercase">
                                      ← Lowest
                                    </span>
                                  )}
                                </td>
                                <td className="w-20">
                                  <ScoreBadge score={entry.score} variant="compact" />
                                </td>
                                <td className="text-sm text-ink-soft">
                                  <span className="line-clamp-1">{entry.title}</span>
                                </td>
                                <td className="w-12 text-right">
                                  <a
                                    href={entry.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-ink-faint group-hover:text-sienna"
                                  >
                                    <ExternalLink size={11} />
                                  </a>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
