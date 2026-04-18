"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

type Run = {
  id: number;
  site_id: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_scraped: number;
  error_message: string | null;
};

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    adminApi.get<Run[]>("/admin/runs").then((r) => setRuns(r.data));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Run History</h1>
      <table className="w-full bg-white rounded shadow">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-3">Site</th>
            <th className="p-3">Status</th>
            <th className="p-3">Started</th>
            <th className="p-3">Items</th>
            <th className="p-3">Error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-3">{r.site_id}</td>
              <td className="p-3">{r.status}</td>
              <td className="p-3">{r.started_at}</td>
              <td className="p-3">{r.items_scraped}</td>
              <td className="p-3 text-red-600">{r.error_message ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
