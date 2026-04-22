"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Clock } from "lucide-react";
import { adminApi } from "@/lib/api";
import { relativeTime } from "@/lib/utils";
import { EnabledDot, StatusPill } from "@/components/ui/StatusPill";
import { TableSkeleton } from "@/components/ui/Skeleton";

type Job = {
  id: number;
  name: string;
  cron_expression: string;
  site_id: number | null;
  enabled: boolean;
  last_status: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
};

type Site = { id: number; name: string };

export default function SchedulePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sitesMap, setSitesMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.get<Job[]>("/admin/schedule"),
      adminApi.get<Site[]>("/admin/sites"),
    ]).then(([j, s]) => {
      setJobs(j.data);
      setSitesMap(new Map(s.data.map((x) => [x.id, x.name])));
      setLoading(false);
    });
  }, []);

  return (
    <div className="animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow mb-2">Admin · Scheduler</div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Scheduled jobs</h1>
          <p className="mt-1 text-ink-soft text-sm">
            Cron jobs that fire scrapes automatically.
          </p>
        </div>
        <Link href="/admin/schedule/new" className="btn-accent">
          <Plus size={14} />
          Add job
        </Link>
      </header>

      {loading ? (
        <TableSkeleton rows={3} cols={5} />
      ) : jobs.length === 0 ? (
        <div className="card p-12 text-center">
          <Clock size={24} className="mx-auto text-ink-faint mb-3" />
          <div className="font-serif text-xl italic text-ink-soft mb-2">
            No scheduled jobs yet.
          </div>
          <p className="text-sm text-ink-faint mb-4">
            Create one to run scrapes automatically.
          </p>
          <Link href="/admin/schedule/new" className="btn-accent inline-flex">
            <Plus size={14} />
            Create job
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden shadow-soft">
          <table className="table-refined">
            <thead>
              <tr>
                <th>Job</th>
                <th className="w-36">Cron</th>
                <th>Target</th>
                <th className="w-24">Status</th>
                <th className="w-28">Next run</th>
                <th className="w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="group">
                  <td className="font-medium text-ink">{j.name}</td>
                  <td>
                    <code className="text-xs bg-ink/5 px-2 py-1 rounded font-mono text-ink-soft">
                      {j.cron_expression}
                    </code>
                  </td>
                  <td>
                    {j.site_id ? (
                      <span>{sitesMap.get(j.site_id) ?? `Site #${j.site_id}`}</span>
                    ) : (
                      <span className="text-2xs tracking-editorial uppercase text-sienna">
                        All enabled sites
                      </span>
                    )}
                  </td>
                  <td><EnabledDot enabled={j.enabled} /></td>
                  <td className="text-xs text-ink-soft">
                    {relativeTime(j.next_run_at)}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/admin/schedule/${j.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-ink-soft hover:bg-ink/5 transition-colors"
                    >
                      <Pencil size={11} />
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
