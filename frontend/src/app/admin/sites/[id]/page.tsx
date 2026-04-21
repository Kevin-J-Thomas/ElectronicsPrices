"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SiteForm, { SiteFormValues } from "@/components/admin/SiteForm";
import { adminApi } from "@/lib/api";

export default function EditSitePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<SiteFormValues | null>(null);

  useEffect(() => {
    adminApi.get(`/admin/sites/${id}`).then((r) => {
      const s = r.data;
      setInitial({
        name: s.name,
        base_url: s.base_url,
        scraper_type: s.scraper_type,
        enabled: s.enabled,
        requires_location: s.requires_location,
        requires_auth: s.requires_auth,
        config: JSON.stringify(s.config ?? {}, null, 2),
        categories: (s.categories ?? []).join(", "),
        concurrent_requests: s.concurrent_requests,
        download_delay_seconds: s.download_delay_seconds,
        use_proxy: s.use_proxy,
        user_agent: s.user_agent ?? "",
      });
    });
  }, [id]);

  async function handleSubmit(values: SiteFormValues) {
    const payload = {
      name: values.name,
      base_url: values.base_url,
      scraper_type: values.scraper_type,
      enabled: values.enabled,
      requires_location: values.requires_location,
      requires_auth: values.requires_auth,
      config: values.config ? JSON.parse(values.config) : {},
      categories: values.categories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      concurrent_requests: values.concurrent_requests,
      download_delay_seconds: values.download_delay_seconds,
      use_proxy: values.use_proxy,
      user_agent: values.user_agent || null,
    };
    await adminApi.patch(`/admin/sites/${id}`, payload);
    router.push("/admin/sites");
  }

  async function handleDelete() {
    if (!confirm("Delete this site? This cannot be undone.")) return;
    await adminApi.delete(`/admin/sites/${id}`);
    router.push("/admin/sites");
  }

  if (!initial) return <p>Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <Link href="/admin/sites" className="text-blue-600 text-sm">← Back to sites</Link>
          <h1 className="text-2xl font-bold mt-2">Edit Site</h1>
        </div>
        <button
          onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Delete
        </button>
      </div>
      <SiteForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />
    </div>
  );
}
