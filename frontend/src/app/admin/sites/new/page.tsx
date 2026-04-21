"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteForm, { SiteFormValues } from "@/components/admin/SiteForm";
import { adminApi } from "@/lib/api";

const defaultValues: SiteFormValues = {
  name: "",
  base_url: "",
  scraper_type: "static",
  enabled: true,
  requires_location: false,
  requires_auth: false,
  config: "{}",
  categories: "",
  concurrent_requests: 4,
  download_delay_seconds: 2.0,
  use_proxy: false,
  user_agent: "",
};

export default function NewSitePage() {
  const router = useRouter();

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
    await adminApi.post("/admin/sites", payload);
    router.push("/admin/sites");
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/sites" className="text-blue-600 text-sm">← Back to sites</Link>
        <h1 className="text-2xl font-bold mt-2">Add Site</h1>
      </div>
      <SiteForm initial={defaultValues} onSubmit={handleSubmit} submitLabel="Create site" />
    </div>
  );
}
