"use client";

import { FormEvent, useState } from "react";

export type SiteFormValues = {
  name: string;
  base_url: string;
  scraper_type: "static" | "dynamic" | "api" | "location";
  enabled: boolean;
  requires_location: boolean;
  requires_auth: boolean;
  config: string;
  categories: string;
  concurrent_requests: number;
  download_delay_seconds: number;
  use_proxy: boolean;
  user_agent: string;
};

type Props = {
  initial: SiteFormValues;
  onSubmit: (values: SiteFormValues) => Promise<void>;
  submitLabel: string;
};

export default function SiteForm({ initial, onSubmit, submitLabel }: Props) {
  const [values, setValues] = useState<SiteFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof SiteFormValues>(key: K, val: SiteFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (values.config.trim()) JSON.parse(values.config);
      await onSubmit(values);
    } catch (err: unknown) {
      const msg =
        err instanceof SyntaxError
          ? "Config must be valid JSON"
          : (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            "Request failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const label = "block text-sm font-medium text-gray-700 mb-1";
  const input =
    "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow max-w-3xl space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Name *</label>
          <input
            className={input}
            required
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="PCStudio"
          />
        </div>
        <div>
          <label className={label}>Scraper type *</label>
          <select
            className={input}
            value={values.scraper_type}
            onChange={(e) => update("scraper_type", e.target.value as SiteFormValues["scraper_type"])}
          >
            <option value="static">static (HTML + CSS selectors)</option>
            <option value="dynamic">dynamic (Playwright — JS-rendered)</option>
            <option value="api">api (internal JSON API)</option>
            <option value="location">location (needs lat/lon/radius)</option>
          </select>
        </div>
      </div>

      <div>
        <label className={label}>Base URL *</label>
        <input
          className={input}
          type="url"
          required
          value={values.base_url}
          onChange={(e) => update("base_url", e.target.value)}
          placeholder="https://www.pcstudio.in"
        />
      </div>

      <div>
        <label className={label}>Categories (comma-separated)</label>
        <input
          className={input}
          value={values.categories}
          onChange={(e) => update("categories", e.target.value)}
          placeholder="laptops, ssds, ram, gpus"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Concurrent requests (1–32)</label>
          <input
            className={input}
            type="number"
            min={1}
            max={32}
            value={values.concurrent_requests}
            onChange={(e) => update("concurrent_requests", parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <div>
          <label className={label}>Download delay (seconds)</label>
          <input
            className={input}
            type="number"
            step={0.5}
            min={0}
            max={60}
            value={values.download_delay_seconds}
            onChange={(e) => update("download_delay_seconds", parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      <div>
        <label className={label}>User agent (optional)</label>
        <input
          className={input}
          value={values.user_agent}
          onChange={(e) => update("user_agent", e.target.value)}
          placeholder="Leave blank for default"
        />
      </div>

      <div>
        <label className={label}>Scraper config (JSON)</label>
        <textarea
          className={`${input} font-mono text-sm`}
          rows={6}
          value={values.config}
          onChange={(e) => update("config", e.target.value)}
          placeholder='{"category_urls": {"laptops": "/laptops"}, "selectors": {"price": ".price"}}'
        />
        <p className="text-xs text-gray-500 mt-1">
          CSS selectors, category URL patterns, pagination rules. Scraper-specific.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
          />
          <span>Enabled</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.use_proxy}
            onChange={(e) => update("use_proxy", e.target.checked)}
          />
          <span>Use proxy</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.requires_location}
            onChange={(e) => update("requires_location", e.target.checked)}
          />
          <span>Requires location (OLX/FB)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.requires_auth}
            onChange={(e) => update("requires_auth", e.target.checked)}
          />
          <span>Requires auth / cookies</span>
        </label>
      </div>

      <div className="pt-4 border-t">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
