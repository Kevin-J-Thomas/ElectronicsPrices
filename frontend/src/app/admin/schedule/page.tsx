"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/api";

type Job = {
  id: number;
  name: string;
  cron_expression: string;
  site_id: number | null;
  enabled: boolean;
  last_status: string | null;
  next_run_at: string | null;
};

export default function SchedulePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get<Job[]>("/admin/schedule").then((r) => {
      setJobs(r.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Scheduled Jobs</h1>
        <Link href="/admin/schedule/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + Add job
        </Link>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="bg-white p-8 rounded shadow text-center text-gray-500">
          No scheduled jobs yet. Create one to run scrapes automatically.
        </div>
      ) : (
        <table className="w-full bg-white rounded shadow">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Cron</th>
              <th className="p-3">Target</th>
              <th className="p-3">Enabled</th>
              <th className="p-3">Next Run</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t">
                <td className="p-3 font-medium">{j.name}</td>
                <td className="p-3 font-mono text-sm">{j.cron_expression}</td>
                <td className="p-3">{j.site_id ? `Site #${j.site_id}` : "All sites"}</td>
                <td className="p-3">{j.enabled ? "✓" : "✗"}</td>
                <td className="p-3 text-sm text-gray-600">{j.next_run_at ?? "—"}</td>
                <td className="p-3">
                  <Link href={`/admin/schedule/${j.id}`} className="text-blue-600">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
