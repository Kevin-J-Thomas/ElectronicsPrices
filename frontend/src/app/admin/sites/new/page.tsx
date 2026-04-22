"use client";

import { useRouter } from "next/navigation";
import NextLink from "next/link";
import { Link as HeroLink } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
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
      categories: values.categories.split(",").map((c) => c.trim()).filter(Boolean),
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
      <HeroLink
        as={NextLink}
        href="/admin/sites"
        size="sm"
        className="inline-flex items-center gap-1.5 text-xs mb-4"
      >
        <ArrowLeft size={12} />
        Back to sites
      </HeroLink>
      <header className="mb-8">
        <div className="eyebrow mb-2">Admin · Sites</div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Add site</h1>
        <p className="mt-2 text-default-500 text-sm max-w-xl">
          Configure a new scraping target. You can fine-tune selectors later — just the name,
          URL and type are required to get started.
        </p>
      </header>
      <SiteForm initial={defaultValues} onSubmit={handleSubmit} submitLabel="Create site" />
    </div>
  );
}
