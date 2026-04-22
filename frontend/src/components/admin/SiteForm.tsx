"use client";

import { FormEvent, useState } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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

const TYPE_DESC: Record<string, string> = {
  static:   "Server-rendered HTML. Fast & cheap. Works for most traditional shops.",
  dynamic:  "JS-rendered pages via Playwright. For Amazon / Flipkart / brand stores.",
  api:      "Site exposes a JSON API. Cleanest, fastest where available.",
  location: "Needs (lat, lon, radius) parameters. For OLX / Facebook Marketplace.",
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

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-md bg-crimson/5 border border-crimson/20 text-sm text-crimson">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Section title="Identity" desc="Basic site info used across the admin and public UI.">
        <div className="grid grid-cols-2 gap-5">
          <Field label="Name" required>
            <input
              className="input"
              required
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="PCStudio"
            />
          </Field>
          <Field label="Scraper type" required>
            <select
              className="input"
              value={values.scraper_type}
              onChange={(e) => update("scraper_type", e.target.value as SiteFormValues["scraper_type"])}
            >
              <option value="static">static</option>
              <option value="dynamic">dynamic</option>
              <option value="api">api</option>
              <option value="location">location</option>
            </select>
            <p className="text-xs text-ink-faint mt-1.5 leading-relaxed">
              {TYPE_DESC[values.scraper_type]}
            </p>
          </Field>
        </div>

        <Field label="Base URL" required>
          <input
            className="input"
            type="url"
            required
            value={values.base_url}
            onChange={(e) => update("base_url", e.target.value)}
            placeholder="https://www.pcstudio.in"
          />
        </Field>

        <Field label="Categories" hint="Comma-separated. Leave blank to use all from config.">
          <input
            className="input"
            value={values.categories}
            onChange={(e) => update("categories", e.target.value)}
            placeholder="laptops, ssds, ram, gpus"
          />
        </Field>
      </Section>

      <Section title="Rate limiting" desc="Tune scraping pace to avoid blocks.">
        <div className="grid grid-cols-2 gap-5">
          <Field label="Concurrent requests" hint="Range 1 – 32">
            <input
              className="input num"
              type="number"
              min={1}
              max={32}
              value={values.concurrent_requests}
              onChange={(e) => update("concurrent_requests", parseInt(e.target.value, 10) || 1)}
            />
          </Field>
          <Field label="Download delay (seconds)" hint="Pause between requests">
            <input
              className="input num"
              type="number"
              step={0.5}
              min={0}
              max={60}
              value={values.download_delay_seconds}
              onChange={(e) => update("download_delay_seconds", parseFloat(e.target.value) || 0)}
            />
          </Field>
        </div>
        <Field label="User agent" hint="Leave blank for default. Override if site is picky.">
          <input
            className="input"
            value={values.user_agent}
            onChange={(e) => update("user_agent", e.target.value)}
            placeholder="Mozilla/5.0 …"
          />
        </Field>
      </Section>

      <Section title="Scraper config" desc="CSS selectors, category URLs, pagination rules — stored as JSON.">
        <Field label="Config (JSON)">
          <textarea
            className="input font-mono text-xs leading-relaxed"
            rows={12}
            value={values.config}
            onChange={(e) => update("config", e.target.value)}
            placeholder={`{
  "category_urls": {"laptops": "/collections/laptops"},
  "selectors": {
    "product_item": "li.product",
    "title": ".title",
    "url": "a",
    "price": ".price"
  },
  "max_pages": 3
}`}
          />
        </Field>
      </Section>

      <Section title="Flags" desc="Toggle behavior.">
        <div className="grid grid-cols-2 gap-3">
          <CheckCard
            checked={values.enabled}
            onChange={(v) => update("enabled", v)}
            label="Enabled"
            desc="Include in scheduled runs"
          />
          <CheckCard
            checked={values.use_proxy}
            onChange={(v) => update("use_proxy", v)}
            label="Use proxy"
            desc="Route through residential pool"
          />
          <CheckCard
            checked={values.requires_location}
            onChange={(v) => update("requires_location", v)}
            label="Requires location"
            desc="OLX / FB Marketplace"
          />
          <CheckCard
            checked={values.requires_auth}
            onChange={(v) => update("requires_auth", v)}
            label="Requires auth"
            desc="Login / cookies needed"
          />
        </div>
      </Section>

      <div className="pt-4 border-t border-line flex justify-end gap-3">
        <button type="submit" disabled={saving} className="btn-accent px-6 py-2.5">
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 shadow-soft">
      <header className="mb-5">
        <div className="eyebrow mb-1">{title}</div>
        <p className="text-xs text-ink-faint">{desc}</p>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="field-label">
          {label}
          {required && <span className="text-sienna ml-1">*</span>}
        </label>
        {hint && <span className="text-2xs text-ink-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function CheckCard({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 p-4 rounded-md border cursor-pointer transition-all",
        checked
          ? "border-sienna bg-sienna/5"
          : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-sienna"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-xs text-ink-faint mt-0.5">{desc}</div>
      </div>
    </label>
  );
}
