"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Search, ListChecks, Activity } from "lucide-react";
import TopNav from "@/components/TopNav";
import { StatSkeleton, ChartSkeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { formatINR, formatNumber } from "@/lib/utils";

type Stats = {
  total_sites: number;
  enabled_sites: number;
  total_listings: number;
  total_price_points: number;
  recent_runs_24h: number;
};

type SeriesItem = {
  listing_id: number;
  title: string;
  site: string;
  points: { t: string; price: number }[];
};

const SERIES_COLORS = ["#B24A29", "#3A6B4C", "#BF852E", "#A9362E", "#4A5B7E", "#5E7B4B", "#8E4E2E", "#2E6B88"];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Stats>("/stats"),
      api.get<{ series: SeriesItem[] }>("/prices/timeseries?limit_products=8&days=14"),
    ]).then(([s, t]) => {
      setStats(s.data);
      setSeries(t.data.series);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Build chart data — one row per timestamp
  const chartData = (() => {
    const map = new Map<string, Record<string, number | string>>();
    series.forEach((s) => {
      s.points.forEach((p) => {
        const key = p.t.slice(0, 16);
        if (!map.has(key)) map.set(key, { t: key });
        map.get(key)![`p${s.listing_id}`] = p.price;
      });
    });
    return Array.from(map.values()).sort((a, b) => String(a.t).localeCompare(String(b.t)));
  })();

  return (
    <>
      <TopNav />
      <main className="max-w-7xl mx-auto px-6 py-10 md:py-14">

        {/* Editorial hero */}
        <section className="mb-12 animate-slide-up">
          <div className="flex items-center gap-3 mb-5">
            <span className="eyebrow">Volume 01 · Live Market</span>
            <span className="h-px flex-1 bg-line" />
            <span className="num text-2xs text-ink-faint">
              {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight text-ink">
            Electronics price{" "}
            <span className="italic text-sienna">intelligence</span>,
            <br />
            <span className="text-ink-soft">tracked across {stats?.total_sites ?? 34} marketplaces.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-soft leading-relaxed">
            From Amazon and Flipkart to dedicated PC retailers — every sale price, every day,
            scored on a <span className="italic text-ink">5-point value scale</span>.
          </p>
        </section>

        {/* Stats strip — horizontal editorial row */}
        <section className="mb-14 animate-slide-up-delay-1">
          <div className="eyebrow mb-3">At a glance</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-line rounded-xl overflow-hidden border border-line">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-surface p-5"><StatSkeleton /></div>
              ))
            ) : (
              <>
                <Stat label="Sites tracked" value={formatNumber(stats?.total_sites ?? 0)} accent />
                <Stat label="Live scrapers" value={formatNumber(stats?.enabled_sites ?? 0)} sub="of total" />
                <Stat label="Listings" value={formatNumber(stats?.total_listings ?? 0)} />
                <Stat label="Price points" value={formatNumber(stats?.total_price_points ?? 0)} />
                <Stat label="Runs · 24h" value={formatNumber(stats?.recent_runs_24h ?? 0)} />
              </>
            )}
          </div>
        </section>

        {/* Hero chart */}
        <section className="mb-14 animate-slide-up-delay-2">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <div className="card p-6 md:p-8 shadow-soft">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                  <div className="eyebrow mb-2 flex items-center gap-2">
                    <Activity size={10} />
                    Price movement · last 14 days
                  </div>
                  <h2 className="font-serif text-3xl font-semibold tracking-tight">
                    Recently tracked products
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-2xs tracking-editorial uppercase text-ink-faint">
                  <span className="w-2 h-2 rounded-sm bg-sienna" />
                  Top {series.length} most recent
                </div>
              </div>

              {chartData.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="h-[380px]">
                  <ResponsiveContainer>
                    <AreaChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: -16 }}>
                      <defs>
                        {series.map((s, i) => (
                          <linearGradient key={s.listing_id} id={`g${s.listing_id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.18} />
                            <stop offset="100%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid stroke="rgb(232 226 213)" strokeDasharray="0" vertical={false} />
                      <XAxis
                        dataKey="t"
                        tick={{ fontSize: 10, fill: "rgb(122 131 148)" }}
                        axisLine={{ stroke: "rgb(232 226 213)" }}
                        tickLine={false}
                        tickFormatter={(v: string) => v.slice(5, 10)}
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "rgb(122 131 148)", fontFamily: "var(--font-mono)" }}
                        axisLine={false}
                        tickLine={false}
                        width={70}
                        tickFormatter={(v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
                      />
                      <Tooltip content={<ChartTooltip series={series} />} />
                      {series.map((s, i) => (
                        <Area
                          key={s.listing_id}
                          type="monotone"
                          dataKey={`p${s.listing_id}`}
                          stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                          strokeWidth={1.5}
                          fill={`url(#g${s.listing_id})`}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 2, stroke: "#FAF7F0" }}
                          connectNulls
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Legend footer */}
              {series.length > 0 && (
                <div className="mt-6 pt-4 border-t border-line grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                  {series.slice(0, 8).map((s, i) => (
                    <div key={s.listing_id} className="flex items-start gap-2 text-xs leading-tight">
                      <span
                        className="shrink-0 mt-1 w-2.5 h-2.5 rounded-sm"
                        style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-ink" title={s.title}>
                          {s.title}
                        </div>
                        <div className="text-2xs tracking-editorial uppercase text-ink-faint mt-0.5">
                          {s.site}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* CTA cards */}
        <section className="grid md:grid-cols-2 gap-4 animate-slide-up-delay-3">
          <CtaCard
            href="/search"
            icon={<Search size={18} />}
            eyebrow="Discover"
            title="Search products"
            desc="Type a product, see its price across every tracked site — sorted by value score."
          />
          <CtaCard
            href="/orders"
            icon={<ListChecks size={18} />}
            eyebrow="Plan"
            title="Build an order list"
            desc="Assemble your shopping list. We'll calculate the cheapest total possible."
          />
        </section>

        <footer className="mt-20 pt-6 border-t border-line flex flex-wrap justify-between gap-4 text-2xs tracking-editorial uppercase text-ink-faint">
          <span>Electronics Inventory · Editorial build</span>
          <span className="num">All prices in INR</span>
        </footer>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface px-5 py-6 relative">
      {accent && (
        <span className="absolute top-0 left-5 w-8 h-0.5 bg-sienna" />
      )}
      <div className="eyebrow mb-3">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-4xl font-semibold tracking-tight tabular-nums text-ink">
          {value}
        </span>
        {sub && <span className="text-xs text-ink-faint">{sub}</span>}
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  series: SeriesItem[];
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="card shadow-lift p-3 text-xs bg-surface">
      <div className="font-mono text-2xs text-ink-faint mb-2">{label}</div>
      {payload.map((p) => {
        const id = String(p.dataKey).slice(1);
        const s = series.find((x) => String(x.listing_id) === id);
        if (!s) return null;
        return (
          <div key={p.dataKey} className="flex items-baseline justify-between gap-4 py-0.5">
            <span className="truncate max-w-[220px]">{s.title.slice(0, 40)}</span>
            <span className="num font-semibold text-ink">{formatINR(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[340px] flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-line/40 flex items-center justify-center">
        <Activity className="text-ink-faint" size={20} />
      </div>
      <div className="text-ink-soft">No price data yet.</div>
      <Link href="/admin/sites" className="btn-outline text-xs">
        Configure a site →
      </Link>
    </div>
  );
}

function CtaCard({
  href,
  icon,
  eyebrow,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group card p-6 card-hover relative overflow-hidden"
    >
      <span className="absolute top-0 right-0 w-24 h-24 bg-sienna/5 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:bg-sienna/10 transition-colors" />
      <div className="relative flex items-start gap-4">
        <div className="w-10 h-10 rounded-md bg-sienna/10 text-sienna flex items-center justify-center group-hover:bg-sienna group-hover:text-white transition-colors shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <div className="eyebrow text-sienna mb-1">{eyebrow}</div>
          <h3 className="font-serif text-2xl font-semibold tracking-tight flex items-center gap-2">
            {title}
            <ArrowRight
              size={18}
              className="text-ink-faint group-hover:text-sienna group-hover:translate-x-1 transition-transform"
            />
          </h3>
          <p className="mt-2 text-sm text-ink-soft leading-relaxed">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
