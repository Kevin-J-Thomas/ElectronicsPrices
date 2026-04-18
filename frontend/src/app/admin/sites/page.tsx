"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/api";

type Site = {
  id: number;
  name: string;
  base_url: string;
  scraper_type: string;
  enabled: boolean;
  last_status: string | null;
  last_run_at: string | null;
};

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get<Site[]>("/admin/sites").then((r) => {
      setSites(r.data);
      setLoading(false);
    });
  }, []);

  async function runNow(id: number) {
    await adminApi.post(`/admin/sites/${id}/run`);
    alert("Scrape queued");
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sites</h1>
        <Link href="/admin/sites/new" className="bg-blue-600 text-white px-4 py-2 rounded">
          + Add site
        </Link>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="w-full bg-white rounded shadow">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Type</th>
              <th className="p-3">Enabled</th>
              <th className="p-3">Last Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{s.name}</td>
                <td className="p-3">{s.scraper_type}</td>
                <td className="p-3">{s.enabled ? "✓" : "✗"}</td>
                <td className="p-3">{s.last_status ?? "—"}</td>
                <td className="p-3 flex gap-2">
                  <Link href={`/admin/sites/${s.id}`} className="text-blue-600">Edit</Link>
                  <button onClick={() => runNow(s.id)} className="text-green-600">Run</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
