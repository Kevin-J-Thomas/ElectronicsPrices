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
  Chip,
} from "@heroui/react";
import { AlertCircle, ChevronDown, ChevronRight, Lightbulb } from "lucide-react";

export type SiteFormValues = {
  name: string;
  base_url: string;
  scraper_type: "static" | "shopify" | "woocommerce" | "dynamic" | "api" | "location";
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
  { key: "static",      label: "static",      desc: "Server-rendered HTML — fast, cheap, no JS. Most WooCommerce / OpenCart sites." },
  { key: "shopify",     label: "shopify",     desc: "Hits the public /products.json API. No selectors needed, just collection handles." },
  { key: "woocommerce", label: "woocommerce", desc: "Hits /wp-json/wc/store/v1/products API. No selectors needed, paginates the catalog." },
  { key: "dynamic",     label: "dynamic",     desc: "JS-rendered via Playwright. For SPAs / Amazon / Flipkart / brand stores." },
  { key: "api",         label: "api",         desc: "Custom JSON API. Cleanest where available." },
  { key: "location",    label: "location",    desc: "Needs (lat, lon, radius). OLX / Facebook Marketplace." },
];

// Per-type starter templates with annotated comments
const STARTER_TEMPLATES: Record<string, string> = {
  static: `{
  "category_urls": {
    "laptops": "/collections/laptops",
    "ssd":     "/collections/ssds"
  },
  "selectors": {
    "product_item": "li.product",
    "title":        ".woocommerce-loop-product__title",
    "url":          "a.woocommerce-LoopProduct-link",
    "price":        "span.price"
  },
  "pagination_pattern": "page/{page}/",
  "max_pages": 5
}`,
  shopify: `{
  "category_handles": {
    "processors":     "processor",
    "graphics-cards": "graphic-cards",
    "ram":            "ram"
  },
  "per_page": 50,
  "max_pages": 5
}`,
  woocommerce: `{
  "per_page": 50,
  "max_pages": 10,
  "request_timeout": 25
}`,
  dynamic: `{
  "category_urls": {
    "laptops":       "/shop/laptops-tablets.html",
    "gaming-laptops":"/shop/gaming-laptops"
  },
  "selectors": {
    "product_item": ".product-item",
    "title":        "a.product-item-link",
    "url":          "a.product-item-link",
    "price":        ".price-wrapper"
  },
  "pagination_pattern": "?p={page}",
  "max_pages": 3,
  "wait_selector": ".product-item",
  "scroll_to_bottom": true,
  "settle_ms": 3000
}`,
  api: `{
  "endpoint": "/api/v1/products",
  "page_param": "page",
  "items_path": "data.products",
  "fields": {"title": "name", "price": "price", "url": "permalink"}
}`,
  location: `{
  "city": "Bangalore",
  "lat": 12.9716,
  "lon": 77.5946,
  "radius_km": 25,
  "category": "computer-components"
}`,
};

export default function SiteForm({ initial, onSubmit, submitLabel }: Props) {
  const [values, setValues] = useState<SiteFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  function update<K extends keyof SiteFormValues>(key: K, val: SiteFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function loadTemplate() {
    const tpl = STARTER_TEMPLATES[values.scraper_type];
    if (!tpl) return;
    if (
      !values.config.trim() ||
      values.config.trim() === "{}" ||
      window.confirm("Replace current config with the example template?")
    ) {
      update("config", tpl);
    }
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
        <CardHeader className="flex-col items-start gap-1.5">
          <div className="flex items-center justify-between w-full">
            <div className="eyebrow">Scraper config</div>
            <Button
              size="sm"
              variant="flat"
              color="primary"
              startContent={<Lightbulb size={13} />}
              onPress={loadTemplate}
            >
              Insert {values.scraper_type} example
            </Button>
          </div>
          <p className="text-xs text-default-500">
            JSON describing where to find products and how to extract them. Format depends on{" "}
            <Chip size="sm" variant="flat" className="text-[10px] mx-0.5">scraper_type</Chip>.
          </p>
        </CardHeader>

        {/* Annotated help — collapsible */}
        <button
          type="button"
          onClick={() => setHelpOpen((o) => !o)}
          className="px-6 -mt-1 mb-1 self-start flex items-center gap-1 text-xs text-default-500 hover:text-foreground transition-colors"
        >
          {helpOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          What goes in here?
        </button>

        {helpOpen && (
          <div className="mx-6 mb-4 rounded-lg bg-content2 border border-divider p-4 text-xs text-default-600 space-y-3">
            <p className="leading-relaxed">
              The fields you need depend on the scraper type. Below is an explanation for{" "}
              <span className="text-primary font-medium">{values.scraper_type}</span>.
            </p>
            {values.scraper_type === "static" && <StaticHelp />}
            {values.scraper_type === "dynamic" && <DynamicHelp />}
            {values.scraper_type === "shopify" && <ShopifyHelp />}
            {values.scraper_type === "woocommerce" && <WooCommerceHelp />}
            {values.scraper_type === "api" && (
              <p className="italic">Custom JSON-API scraper not yet implemented in this build.</p>
            )}
            {values.scraper_type === "location" && (
              <p className="italic">
                Location scraper not yet implemented (FB Marketplace / OLX).
              </p>
            )}
          </div>
        )}

        <CardBody>
          <Textarea
            label="Config (JSON)"
            variant="bordered"
            minRows={14}
            value={values.config}
            onChange={(e) => update("config", e.target.value)}
            classNames={{ input: "font-mono text-xs leading-relaxed" }}
            placeholder={STARTER_TEMPLATES[values.scraper_type] || "{}"}
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

function HelpRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
      <code className="font-mono text-[11px] bg-content1 border border-divider px-1.5 py-0.5 rounded shrink-0 text-primary">
        {k}
      </code>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function StaticHelp() {
  return (
    <div className="space-y-2">
      <HelpRow k="category_urls">
        Map of <em>category-name → relative URL path</em>. Each URL gets fetched as plain HTML.
        Example: <code className="font-mono text-[11px]">{`{"laptops": "/collections/laptops"}`}</code>
      </HelpRow>
      <HelpRow k="selectors.product_item">
        CSS selector for the wrapping element of each product card on a category page (e.g.{" "}
        <code className="font-mono text-[11px]">li.product</code>,{" "}
        <code className="font-mono text-[11px]">.product-thumb</code>).
      </HelpRow>
      <HelpRow k="selectors.title / url / price">
        Selectors looked up <em>inside</em> each product wrapper. Title can be an{" "}
        <code className="font-mono text-[11px]">img[alt]</code> if titles aren&apos;t in text.
      </HelpRow>
      <HelpRow k="pagination_pattern">
        URL fragment appended for pages 2+. Examples:{" "}
        <code className="font-mono text-[11px]">page/{`{page}`}/</code> (WordPress),{" "}
        <code className="font-mono text-[11px]">?page={`{page}`}</code> (most others).
      </HelpRow>
      <HelpRow k="max_pages">
        How many pages of each category to fetch. Higher = more data but more risk of getting
        blocked.
      </HelpRow>
    </div>
  );
}

function DynamicHelp() {
  return (
    <div className="space-y-2">
      <HelpRow k="category_urls">
        Same as static — map of <em>category-name → relative URL</em>.
      </HelpRow>
      <HelpRow k="selectors">
        CSS selectors. Apply to the rendered DOM <em>after</em> JavaScript runs, so they can
        target classes that don&apos;t exist in raw HTML.
      </HelpRow>
      <HelpRow k="wait_selector">
        Selector Playwright waits for before reading the DOM. Use the same as{" "}
        <code className="font-mono text-[11px]">product_item</code> in most cases.
      </HelpRow>
      <HelpRow k="settle_ms">
        Extra milliseconds to wait after scroll. Default 1500. Increase for slow-loading sites.
      </HelpRow>
      <HelpRow k="scroll_to_bottom">
        Whether to auto-scroll to trigger lazy-loaded products. Usually <code>true</code>.
      </HelpRow>
      <HelpRow k="max_pages">
        Pages to crawl per category. Dynamic scraping is slower (~5–10s per page).
      </HelpRow>
    </div>
  );
}

function ShopifyHelp() {
  return (
    <div className="space-y-2">
      <p className="text-default-500">
        Shopify exposes a free public API at{" "}
        <code className="font-mono text-[11px]">/collections/&lt;handle&gt;/products.json</code> —
        no selectors needed.
      </p>
      <HelpRow k="category_handles">
        Map of <em>local-name → Shopify collection handle</em>. The handle is the slug shown in
        the URL when you visit a collection (e.g. for{" "}
        <code className="font-mono text-[11px]">/collections/graphic-cards</code> the handle is{" "}
        <code className="font-mono text-[11px]">graphic-cards</code>).
      </HelpRow>
      <HelpRow k="per_page">
        Items per API request. Max 250 (Shopify limit). Default 50.
      </HelpRow>
      <HelpRow k="max_pages">
        Pages to fetch per collection. With per_page=50 + max_pages=5 you get up to 250
        items/collection.
      </HelpRow>
    </div>
  );
}

function WooCommerceHelp() {
  return (
    <div className="space-y-2">
      <p className="text-default-500">
        WooCommerce ships a public Store API at{" "}
        <code className="font-mono text-[11px]">/wp-json/wc/store/v1/products</code>. No
        selectors. Paginates the entire catalog by default.
      </p>
      <HelpRow k="per_page">
        Items per API request. Max 100 (Woo limit). Default 50.
      </HelpRow>
      <HelpRow k="max_pages">
        Pages to fetch. With per_page=50 + max_pages=10 you get up to 500 products.
      </HelpRow>
      <HelpRow k="category_slugs (optional)">
        Limit to specific categories: <code className="font-mono text-[11px]">{`["processor", "ram"]`}</code>.
        Leave empty to scrape everything.
      </HelpRow>
      <HelpRow k="request_timeout">
        Seconds before giving up on a single request. Default 25.
      </HelpRow>
    </div>
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
