"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
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
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Divider,
  Chip,
} from "@heroui/react";
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
    ])
      .then(([s, t]) => {
        setStats(s.data);
        setSeries(t.data.series);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <span className="eyebrow">Volume 01 · Live Market</span>
            <span className="h-px flex-1 bg-divider" />
            <span className="num text-[10px] text-default-500">
              {new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight">
            Electronics price{" "}
            <span className="italic text-primary">intelligence</span>,
            <br />
            <span className="text-default-600">
              tracked across {stats?.total_sites ?? 34} marketplaces.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-default-600 leading-relaxed">
            From Amazon and Flipkart to dedicated PC retailers — every sale price, every day,
            scored on a <span className="italic text-foreground">5-point value scale</span>.
          </p>
        </section>

        {/* Stats grid */}
        <section className="mb-14">
          <div className="eyebrow mb-3">At a glance</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)
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

        {/* Chart */}
        <section className="mb-14">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <Card shadow="sm">
              <CardHeader className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="eyebrow mb-2 flex items-center gap-2">
                    <Activity size={10} />
                    Price movement · last 14 days
                  </div>
                  <h2 className="font-serif text-3xl font-semibold tracking-tight">
                    Recently tracked products
                  </h2>
                </div>
                <Chip size="sm" variant="flat" color="primary">
                  Top {series.length} most recent
                </Chip>
              </CardHeader>
              <CardBody>
                {chartData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <div className="h-[380px]">
                    <ResponsiveContainer>
                      <AreaChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: -16 }}>
                        <defs>
                          {series.map((s, i) => (
                            <linearGradient
                              key={s.listing_id}
                              id={`g${s.listing_id}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
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
                          tick={{
                            fontSize: 10,
                            fill: "rgb(122 131 148)",
                            fontFamily: "var(--font-mono)",
                          }}
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

                {series.length > 0 && (
                  <>
                    <Divider className="my-5" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                      {series.slice(0, 8).map((s, i) => (
                        <div key={s.listing_id} className="flex items-start gap-2 text-xs leading-tight">
                          <span
                            className="shrink-0 mt-1 w-2.5 h-2.5 rounded-sm"
                            style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-foreground" title={s.title}>
                              {s.title}
                            </div>
                            <div className="text-[10px] tracking-editorial uppercase text-default-500 mt-0.5">
                              {s.site}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          )}
        </section>

        {/* CTA cards */}
        <section className="grid md:grid-cols-2 gap-4">
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

        <footer className="mt-20 pt-6 border-t border-divider flex flex-wrap justify-between gap-4 text-[10px] tracking-editorial uppercase text-default-500">
          <span>Electronics Inventory · HeroUI build</span>
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
    <Card shadow="sm" className="relative overflow-hidden">
      <CardBody className="py-5 px-5">
        {accent && <span className="absolute top-0 left-5 w-8 h-0.5 bg-primary" />}
        <div className="eyebrow mb-3">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-4xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {sub && <span className="text-xs text-default-500">{sub}</span>}
        </div>
      </CardBody>
    </Card>
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
    <Card shadow="md" className="p-3 text-xs">
      <div className="font-mono text-[10px] text-default-500 mb-2">{label}</div>
      {payload.map((p) => {
        const id = String(p.dataKey).slice(1);
        const s = series.find((x) => String(x.listing_id) === id);
        if (!s) return null;
        return (
          <div key={p.dataKey} className="flex items-baseline justify-between gap-4 py-0.5">
            <span className="truncate max-w-[220px]">{s.title.slice(0, 40)}</span>
            <span className="num font-semibold">{formatINR(p.value)}</span>
          </div>
        );
      })}
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-[340px] flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-default-100 flex items-center justify-center">
        <Activity className="text-default-500" size={20} />
      </div>
      <div className="text-default-600">No price data yet.</div>
      <Button as={NextLink} href="/admin/sites" variant="bordered" size="sm">
        Configure a site →
      </Button>
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
    <Card
      as={NextLink}
      href={href}
      isPressable
      shadow="sm"
      className="group relative overflow-hidden"
    >
      <span className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:bg-primary/10 transition-colors" />
      <CardBody className="flex-row items-start gap-4 p-6">
        <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
          {icon}
        </div>
        <div className="flex-1 text-left">
          <div className="eyebrow text-primary mb-1">{eyebrow}</div>
          <h3 className="font-serif text-2xl font-semibold tracking-tight flex items-center gap-2">
            {title}
            <ArrowRight
              size={18}
              className="text-default-500 group-hover:text-primary group-hover:translate-x-1 transition-transform"
            />
          </h3>
          <p className="mt-2 text-sm text-default-600 leading-relaxed">{desc}</p>
        </div>
      </CardBody>
    </Card>
  );
}
