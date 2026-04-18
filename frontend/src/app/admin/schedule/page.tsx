"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    adminApi.get<Job[]>("/admin/schedule").then((r) => setJobs(r.data));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Scheduled Jobs</h1>
      <table className="w-full bg-white rounded shadow">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-3">Name</th>
            <th className="p-3">Cron</th>
            <th className="p-3">Site</th>
            <th className="p-3">Enabled</th>
            <th className="p-3">Next Run</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-t">
              <td className="p-3">{j.name}</td>
              <td className="p-3 font-mono text-sm">{j.cron_expression}</td>
              <td className="p-3">{j.site_id ?? "All sites"}</td>
              <td className="p-3">{j.enabled ? "✓" : "✗"}</td>
              <td className="p-3">{j.next_run_at ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
