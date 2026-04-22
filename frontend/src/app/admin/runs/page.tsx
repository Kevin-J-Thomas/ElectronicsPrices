"use client";

import { useEffect, useState } from "react";
import { History, AlertCircle, RefreshCw } from "lucide-react";
import { adminApi } from "@/lib/api";
import { formatNumber, relativeTime } from "@/lib/utils";
import { StatusPill } from "@/components/ui/StatusPill";
import { TableSkeleton } from "@/components/ui/Skeleton";

type Run = {
  id: number;
  site_id: number;
  job_id: number | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_scraped: number;
  items_new: number;
  items_updated: number;
  error_message: string | null;
};

type Site = { id: number; name: string };

const FILTERS = [
  { value: "", label: "All" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
];

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [sitesMap, setSitesMap] = useState<Map<number, string>>(new Map());
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params: Record<string, string> = { limit: "100" };
    if (statusFilter) params.status = statusFilter;
    const [runsRes, sitesRes] = await Promise.all([
      adminApi.get<Run[]>("/admin/runs", { params }),
      adminApi.get<Site[]>("/admin/sites"),
    ]);
    setRuns(runsRes.data);
    setSitesMap(new Map(sitesRes.data.map((x) => [x.id, x.name])));
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  const stats = {
    total: runs.length,
    success: runs.filter((r) => r.status === "success").length,
    failed: runs.filter((r) => r.status === "failed").length,
    totalItems: runs.reduce((a, r) => a + r.items_scraped, 0),
  };

  return (
    <div className="animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow mb-2">Admin · History</div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Run history</h1>
          <p className="mt-1 text-ink-soft text-sm">Recent scrape executions.</p>
        </div>
        <button onClick={load} className="btn-outline">
          <RefreshCw size={13} />
          Refresh
        </button>
      </header>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line rounded-xl overflow-hidden border border-line mb-6">
        <Summary label="Shown" value={formatNumber(stats.total)} />
        <Summary label="Success" value={formatNumber(stats.success)} tone="sage" />
        <Summary label="Failed" value={formatNumber(stats.failed)} tone="crimson" />
        <Summary label="Items scraped" value={formatNumber(stats.totalItems)} />
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex items-center gap-2">
        <span className="eyebrow mr-1">Filter</span>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === f.value
                ? "bg-sienna text-white border-sienna"
                : "bg-surface border-line text-ink-soft hover:border-sienna hover:text-sienna"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : runs.length === 0 ? (
        <div className="card p-12 text-center">
          <History size={24} className="mx-auto text-ink-faint mb-3" />
          <div className="font-serif text-xl italic text-ink-soft">
            No scrape runs{statusFilter ? ` with status "${statusFilter}"` : ""}.
          </div>
          <p className="text-sm text-ink-faint mt-2">
            Trigger a scrape from the Sites page to see activity here.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden shadow-soft">
          <table className="table-refined">
            <thead>
              <tr>
                <th className="w-20 text-right">Run</th>
                <th>Site</th>
                <th className="w-28">Status</th>
                <th className="w-24 text-right">Items</th>
                <th className="w-20 text-right">New</th>
                <th className="w-24">Started</th>
                <th>Error</th>
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
                  <td className="num text-right text-sage">
                    {r.items_new > 0 ? `+${r.items_new}` : ""}
                  </td>
                  <td className="text-xs text-ink-soft">{relativeTime(r.started_at)}</td>
                  <td className="max-w-md">
                    {r.error_message ? (
                      <div className="flex items-start gap-1.5 text-xs text-crimson">
                        <AlertCircle size={12} className="mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{r.error_message}</span>
                      </div>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
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

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "sage" | "crimson";
}) {
  const toneClass =
    tone === "sage" ? "text-sage" : tone === "crimson" ? "text-crimson" : "text-ink";
  return (
    <div className="bg-surface px-5 py-4">
      <div className="eyebrow mb-1.5">{label}</div>
      <div className={`font-serif text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
