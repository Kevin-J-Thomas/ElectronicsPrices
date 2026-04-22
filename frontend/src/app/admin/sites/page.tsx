"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Play, Pencil, ExternalLink, Search } from "lucide-react";
import { adminApi } from "@/lib/api";
import { relativeTime } from "@/lib/utils";
import { EnabledDot, StatusPill } from "@/components/ui/StatusPill";
import { TableSkeleton } from "@/components/ui/Skeleton";

type Site = {
  id: number;
  name: string;
  base_url: string;
  scraper_type: string;
  enabled: boolean;
  last_status: string | null;
  last_run_at: string | null;
  requires_location: boolean;
  categories?: string[];
};

const TYPE_META: Record<string, { label: string; className: string }> = {
  static:   { label: "STATIC",   className: "text-ink-soft bg-ink/5" },
  dynamic:  { label: "DYNAMIC",  className: "text-sienna bg-sienna/10" },
  api:      { label: "API",      className: "text-sage bg-sage/10" },
  location: { label: "LOCATION", className: "text-amber bg-amber/10" },
};

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [running, setRunning] = useState<Set<number>>(new Set());

  useEffect(() => {
    adminApi.get<Site[]>("/admin/sites").then((r) => {
      setSites(r.data);
      setLoading(false);
    });
  }, []);

  async function runNow(id: number) {
    setRunning((s) => new Set(s).add(id));
    try {
      await adminApi.post(`/admin/sites/${id}/run`);
    } finally {
      setTimeout(() => {
        setRunning((s) => {
          const copy = new Set(s);
          copy.delete(id);
          return copy;
        });
      }, 1500);
    }
  }

  const filtered = sites.filter((s) =>
    !filter
      ? true
      : s.name.toLowerCase().includes(filter.toLowerCase()) ||
        s.base_url.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow mb-2">Admin · Sites</div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            Configured sites
          </h1>
          <p className="mt-1 text-ink-soft text-sm">
            {sites.length} total, {sites.filter((s) => s.enabled).length} enabled
          </p>
        </div>
        <Link href="/admin/sites/new" className="btn-accent">
          <Plus size={14} />
          Add site
        </Link>
      </header>

      {/* Filter bar */}
      <div className="mb-4 relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or URL…"
          className="input pl-9"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="font-serif text-xl italic text-ink-soft mb-2">
            {sites.length === 0 ? "No sites configured yet." : `No matches for "${filter}".`}
          </div>
          {sites.length === 0 && (
            <Link href="/admin/sites/new" className="btn-accent mt-4 inline-flex">
              <Plus size={14} />
              Add your first site
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden shadow-soft">
          <table className="table-refined">
            <thead>
              <tr>
                <th>Site</th>
                <th className="w-28">Type</th>
                <th className="w-24">Status</th>
                <th className="w-24">Last run</th>
                <th className="w-28">Last status</th>
                <th className="w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const meta = TYPE_META[s.scraper_type] ?? { label: s.scraper_type.toUpperCase(), className: "text-ink-soft bg-ink/5" };
                return (
                  <tr key={s.id} className="group">
                    <td>
                      <div className="flex flex-col">
                        <span className="font-medium text-ink flex items-center gap-2">
                          {s.name}
                          {s.requires_location && (
                            <span className="text-2xs px-1.5 py-0.5 rounded bg-amber/10 text-amber tracking-wider uppercase">
                              Location
                            </span>
                          )}
                        </span>
                        <a
                          href={s.base_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-ink-faint hover:text-sienna inline-flex items-center gap-1 mt-0.5 max-w-[280px] truncate"
                        >
                          {s.base_url.replace(/^https?:\/\//, "")}
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-block text-2xs tracking-editorial px-2 py-0.5 rounded ${meta.className}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td><EnabledDot enabled={s.enabled} /></td>
                    <td className="text-xs text-ink-soft">
                      {relativeTime(s.last_run_at)}
                    </td>
                    <td><StatusPill status={s.last_status} /></td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => runNow(s.id)}
                          disabled={running.has(s.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-sage hover:bg-sage/10 transition-colors disabled:opacity-50"
                        >
                          <Play size={11} />
                          {running.has(s.id) ? "Queued" : "Run"}
                        </button>
                        <Link
                          href={`/admin/sites/${s.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-ink-soft hover:bg-ink/5 transition-colors"
                        >
                          <Pencil size={11} />
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
