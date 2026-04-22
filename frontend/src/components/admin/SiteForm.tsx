"use client";

import { FormEvent, useState } from "react";
import {
  Input,
  Textarea,
  Select,
  SelectItem,
  Switch,
  Button,
  Card,
  CardBody,
  CardHeader,
} from "@heroui/react";
import { AlertCircle } from "lucide-react";

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

const TYPE_OPTIONS = [
  { key: "static", label: "static", desc: "Server-rendered HTML. Fast & cheap. Works for most traditional shops." },
  { key: "dynamic", label: "dynamic", desc: "JS-rendered pages via Playwright. For Amazon / Flipkart / brand stores." },
  { key: "api", label: "api", desc: "Site exposes a JSON API. Cleanest, fastest where available." },
  { key: "location", label: "location", desc: "Needs (lat, lon, radius) parameters. For OLX / Facebook Marketplace." },
];

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

  const typeDesc = TYPE_OPTIONS.find((o) => o.key === values.scraper_type)?.desc;

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {error && (
        <Card className="border border-danger/20 bg-danger/5">
          <CardBody className="flex-row items-start gap-2 text-sm text-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </CardBody>
        </Card>
      )}

      <Card shadow="sm">
        <CardHeader className="flex-col items-start">
          <div className="eyebrow">Identity</div>
          <p className="text-xs text-default-500 mt-1">
            Basic site info used across the admin and public UI.
          </p>
        </CardHeader>
        <CardBody className="gap-5">
          <div className="grid grid-cols-2 gap-5">
            <Input
              label="Name"
              isRequired
              variant="bordered"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="PCStudio"
            />
            <Select
              label="Scraper type"
              isRequired
              variant="bordered"
              selectedKeys={[values.scraper_type]}
              onChange={(e) =>
                update("scraper_type", e.target.value as SiteFormValues["scraper_type"])
              }
              description={typeDesc}
            >
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.key}>{t.label}</SelectItem>
              ))}
            </Select>
          </div>

          <Input
            label="Base URL"
            isRequired
            type="url"
            variant="bordered"
            value={values.base_url}
            onChange={(e) => update("base_url", e.target.value)}
            placeholder="https://www.pcstudio.in"
          />

          <Input
            label="Categories"
            description="Comma-separated. Leave blank to use all from config."
            variant="bordered"
            value={values.categories}
            onChange={(e) => update("categories", e.target.value)}
            placeholder="laptops, ssds, ram, gpus"
          />
        </CardBody>
      </Card>

      <Card shadow="sm">
        <CardHeader className="flex-col items-start">
          <div className="eyebrow">Rate limiting</div>
          <p className="text-xs text-default-500 mt-1">
            Tune scraping pace to avoid blocks.
          </p>
        </CardHeader>
        <CardBody className="gap-5">
          <div className="grid grid-cols-2 gap-5">
            <Input
              label="Concurrent requests"
              description="Range 1 – 32"
              type="number"
              min={1}
              max={32}
              variant="bordered"
              classNames={{ input: "num" }}
              value={String(values.concurrent_requests)}
              onChange={(e) => update("concurrent_requests", parseInt(e.target.value, 10) || 1)}
            />
            <Input
              label="Download delay (seconds)"
              description="Pause between requests"
              type="number"
              step={0.5}
              min={0}
              max={60}
              variant="bordered"
              classNames={{ input: "num" }}
              value={String(values.download_delay_seconds)}
              onChange={(e) =>
                update("download_delay_seconds", parseFloat(e.target.value) || 0)
              }
            />
          </div>
          <Input
            label="User agent"
            description="Leave blank for default. Override if site is picky."
            variant="bordered"
            value={values.user_agent}
            onChange={(e) => update("user_agent", e.target.value)}
            placeholder="Mozilla/5.0 …"
          />
        </CardBody>
      </Card>

      <Card shadow="sm">
        <CardHeader className="flex-col items-start">
          <div className="eyebrow">Scraper config</div>
          <p className="text-xs text-default-500 mt-1">
            CSS selectors, category URLs, pagination rules — stored as JSON.
          </p>
        </CardHeader>
        <CardBody>
          <Textarea
            label="Config (JSON)"
            variant="bordered"
            minRows={12}
            value={values.config}
            onChange={(e) => update("config", e.target.value)}
            classNames={{ input: "font-mono text-xs leading-relaxed" }}
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
        </CardBody>
      </Card>

      <Card shadow="sm">
        <CardHeader className="flex-col items-start">
          <div className="eyebrow">Flags</div>
          <p className="text-xs text-default-500 mt-1">Toggle behavior.</p>
        </CardHeader>
        <CardBody className="gap-4">
          <div className="grid grid-cols-2 gap-3">
            <ToggleCard
              value={values.enabled}
              onChange={(v) => update("enabled", v)}
              label="Enabled"
              desc="Include in scheduled runs"
            />
            <ToggleCard
              value={values.use_proxy}
              onChange={(v) => update("use_proxy", v)}
              label="Use proxy"
              desc="Route through residential pool"
            />
            <ToggleCard
              value={values.requires_location}
              onChange={(v) => update("requires_location", v)}
              label="Requires location"
              desc="OLX / FB Marketplace"
            />
            <ToggleCard
              value={values.requires_auth}
              onChange={(v) => update("requires_auth", v)}
              label="Requires auth"
              desc="Login / cookies needed"
            />
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" color="primary" isLoading={saving} size="lg">
          {saving ? "Saving" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function ToggleCard({
  value,
  onChange,
  label,
  desc,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
}) {
  return (
    <Card
      shadow="none"
      className={`border ${value ? "border-primary bg-primary/5" : "border-divider"} transition-colors`}
    >
      <CardBody className="flex-row items-start justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-default-500 mt-0.5">{desc}</div>
        </div>
        <Switch isSelected={value} onValueChange={onChange} size="sm" color="primary" />
      </CardBody>
    </Card>
  );
}
