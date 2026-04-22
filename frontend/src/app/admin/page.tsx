"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Clock, History, ArrowRight, Zap } from "lucide-react";
import { api, adminApi } from "@/lib/api";
import { formatNumber, relativeTime } from "@/lib/utils";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";

type Stats = {
  total_sites: number;
  enabled_sites: number;
  total_listings: number;
  total_price_points: number;
  recent_runs_24h: number;
};

type Run = {
  id: number;
  site_id: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_scraped: number;
  error_message: string | null;
};

type Site = { id: number; name: string };

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [sitesMap, setSitesMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Stats>("/stats"),
      adminApi.get<Run[]>("/admin/runs?limit=8"),
      adminApi.get<Site[]>("/admin/sites"),
    ]).then(([s, r, siteRes]) => {
      setStats(s.data);
      setRuns(r.data);
      setSitesMap(new Map(siteRes.data.map((s) => [s.id, s.name])));
      setLoading(false);
    });
  }, []);

  return (
    <div className="animate-fade-in">
      <header className="mb-10">
        <div className="eyebrow mb-3">Admin · Overview</div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">
          Control room
        </h1>
        <p className="mt-2 text-ink-soft">
          Manage scrapers, schedules, and observe run history.
        </p>
      </header>

      {/* Stats grid */}
      <section className="mb-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-line rounded-xl overflow-hidden border border-line">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-surface p-5">
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))
          ) : (
            <>
              <AdminStat label="Sites" value={stats?.total_sites ?? 0} accent />
              <AdminStat label="Enabled" value={stats?.enabled_sites ?? 0} />
              <AdminStat label="Listings" value={stats?.total_listings ?? 0} />
              <AdminStat label="Price points" value={stats?.total_price_points ?? 0} />
              <AdminStat label="Runs (24h)" value={stats?.recent_runs_24h ?? 0} />
            </>
          )}
        </div>
      </section>

      {/* Quick actions */}
      <section className="mb-10">
        <div className="eyebrow mb-3">Quick actions</div>
        <div className="grid md:grid-cols-3 gap-4">
          <QuickAction
            href="/admin/sites"
            icon={<Globe size={16} />}
            title="Sites"
            desc="Add, edit, or trigger scrapes"
          />
          <QuickAction
            href="/admin/schedule"
            icon={<Clock size={16} />}
            title="Scheduler"
            desc="Manage cron jobs"
          />
          <QuickAction
            href="/admin/runs"
            icon={<History size={16} />}
            title="Run history"
            desc="Inspect past scrapes"
          />
        </div>
      </section>

      {/* Recent runs */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="eyebrow mb-1 flex items-center gap-2">
              <Zap size={10} />
              Recent activity
            </div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight">
              Latest scrapes
            </h2>
          </div>
          <Link href="/admin/runs" className="text-xs text-ink-faint hover:text-sienna">
            View all →
          </Link>
        </div>

        <div className="card overflow-hidden shadow-soft">
          {loading ? (
            <div className="p-8 text-center"><Skeleton className="h-4 w-40 mx-auto" /></div>
          ) : runs.length === 0 ? (
            <div className="p-8 text-center text-ink-faint italic">No scrape runs yet.</div>
          ) : (
            <table className="table-refined">
              <thead>
                <tr>
                  <th className="w-16 text-right">Run</th>
                  <th>Site</th>
                  <th className="w-28">Status</th>
                  <th className="w-20 text-right">Items</th>
                  <th className="w-32">Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="num text-xs text-ink-faint text-right">#{r.id}</td>
                    <td className="font-medium">
                      {sitesMap.get(r.site_id) ?? `Site #${r.site_id}`}
                    </td>
                    <td><StatusPill status={r.status} /></td>
                    <td className="num text-right">{formatNumber(r.items_scraped)}</td>
                    <td className="text-ink-soft text-sm">{relativeTime(r.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function AdminStat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-surface px-5 py-5 relative">
      {accent && <span className="absolute top-0 left-5 w-8 h-0.5 bg-sienna" />}
      <div className="eyebrow mb-2">{label}</div>
      <div className="font-serif text-3xl font-semibold tracking-tight tabular-nums text-ink">
        {formatNumber(value)}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="card p-5 card-hover group flex items-center gap-4">
      <div className="w-10 h-10 rounded-md bg-sienna/10 text-sienna flex items-center justify-center group-hover:bg-sienna group-hover:text-white transition-colors shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-serif text-lg font-semibold">{title}</span>
          <ArrowRight size={14} className="text-ink-faint group-hover:text-sienna group-hover:translate-x-1 transition-transform" />
        </div>
        <p className="text-xs text-ink-soft mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}
