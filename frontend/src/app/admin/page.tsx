"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import {
  Card,
  CardBody,
  CardHeader,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Link as HeroLink,
} from "@heroui/react";
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
    <div>
      <header className="mb-10">
        <div className="eyebrow mb-3">Admin · Overview</div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Control room</h1>
        <p className="mt-2 text-default-500">
          Manage scrapers, schedules, and observe run history.
        </p>
      </header>

      {/* Stats grid */}
      <section className="mb-10 grid grid-cols-2 md:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} shadow="sm">
              <CardBody className="gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </CardBody>
            </Card>
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
            <h2 className="font-serif text-2xl font-semibold tracking-tight">Latest scrapes</h2>
          </div>
          <HeroLink as={NextLink} href="/admin/runs" size="sm">
            View all →
          </HeroLink>
        </div>

        {loading ? (
          <Card shadow="sm">
            <CardBody className="p-8 text-center">
              <Skeleton className="h-4 w-40 mx-auto" />
            </CardBody>
          </Card>
        ) : runs.length === 0 ? (
          <Card shadow="sm">
            <CardBody className="p-8 text-center text-default-500 italic">
              No scrape runs yet.
            </CardBody>
          </Card>
        ) : (
          <Table
            aria-label="Recent runs"
            shadow="sm"
            classNames={{ th: "text-[10px] tracking-editorial uppercase bg-default-100" }}
          >
            <TableHeader>
              <TableColumn>Run</TableColumn>
              <TableColumn>Site</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn align="end">Items</TableColumn>
              <TableColumn>Started</TableColumn>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="num text-xs text-default-400">#{r.id}</TableCell>
                  <TableCell className="font-medium">
                    {sitesMap.get(r.site_id) ?? `Site #${r.site_id}`}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={r.status} />
                  </TableCell>
                  <TableCell className="num">{formatNumber(r.items_scraped)}</TableCell>
                  <TableCell className="text-default-500 text-sm">
                    {relativeTime(r.started_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function AdminStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card shadow="sm" className="relative overflow-hidden">
      <CardBody>
        {accent && <span className="absolute top-0 left-5 w-8 h-0.5 bg-primary" />}
        <div className="eyebrow mb-2">{label}</div>
        <div className="font-serif text-3xl font-semibold tracking-tight tabular-nums">
          {formatNumber(value)}
        </div>
      </CardBody>
    </Card>
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
    <Card as={NextLink} href={href} isPressable shadow="sm" className="group">
      <CardBody className="flex-row items-center gap-4 p-5">
        <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
          {icon}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-lg font-semibold">{title}</span>
            <ArrowRight
              size={14}
              className="text-default-500 group-hover:text-primary group-hover:translate-x-1 transition-transform"
            />
          </div>
          <p className="text-xs text-default-500 mt-0.5">{desc}</p>
        </div>
      </CardBody>
    </Card>
  );
}
