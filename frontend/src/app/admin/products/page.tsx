"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import {
  Button,
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Switch,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
  Tooltip,
} from "@heroui/react";
import { Layers, PlayCircle, RotateCcw, RefreshCw, Info, X, Package, Building2, Sparkles } from "lucide-react";
import { adminApi } from "@/lib/api";
import { TableSkeleton } from "@/components/ui/Skeleton";

type Stats = {
  total_listings: number;
  grouped_listings: number;
  ungrouped_listings: number;
  total_products: number;
  multi_site_products: number;
  coverage_pct: number;
};

type Product = {
  id: number;
  canonical_name: string;
  brand: string | null;
  model: string | null;
  listing_count: number;
  site_count: number;
};

type GroupRunResult = {
  processed: number;
  assigned_existing: number;
  created_products: number;
  skipped: number;
  total_products: number;
};

const HELP_DISMISS_KEY = "admin.products.helpDismissed";

export default function ProductsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<GroupRunResult | null>(null);
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowHelp(localStorage.getItem(HELP_DISMISS_KEY) !== "1");
    }
  }, []);

  function dismissHelp() {
    setShowHelp(false);
    if (typeof window !== "undefined") localStorage.setItem(HELP_DISMISS_KEY, "1");
  }

  function reopenHelp() {
    setShowHelp(true);
    if (typeof window !== "undefined") localStorage.removeItem(HELP_DISMISS_KEY);
  }

  const resetModal = useDisclosure();

  async function load() {
    setLoading(true);
    const [s, p] = await Promise.all([
      adminApi.get<Stats>("/admin/grouping/stats"),
      adminApi.get<Product[]>("/admin/grouping/products", {
        params: { multi_site: onlyMulti, limit: 100 },
      }),
    ]);
    setStats(s.data);
    setProducts(p.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyMulti]);

  async function runGrouping() {
    setRunning(true);
    try {
      const r = await adminApi.post<GroupRunResult>("/admin/grouping/run");
      setLastResult(r.data);
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function resetGrouping() {
    setRunning(true);
    try {
      const r = await adminApi.post<GroupRunResult>("/admin/grouping/reset");
      setLastResult(r.data);
      await load();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[11px] font-semibold tracking-editorial uppercase text-default-500 mb-2">
            Admin · Intelligence
          </div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
            Product grouping
          </h1>
          <p className="mt-1 text-default-500 text-sm max-w-2xl">
            Cluster the same product across marketplaces so the value score compares apples to
            apples. Uses fuzzy title matching (RapidFuzz · token_set_ratio ≥ 85).
          </p>
        </div>
        <div className="flex gap-2">
          {!showHelp && (
            <Tooltip content="Show explanation" size="sm">
              <Button
                isIconOnly
                variant="bordered"
                onPress={reopenHelp}
                aria-label="Show help"
                className="text-default-500 border-default-300"
              >
                <Info size={16} />
              </Button>
            </Tooltip>
          )}
          <Button
            color="primary"
            onPress={runGrouping}
            isLoading={running}
            startContent={!running && <PlayCircle size={16} />}
          >
            {running ? "Grouping" : "Run grouping"}
          </Button>
          <Button
            color="danger"
            variant="flat"
            onPress={resetModal.onOpen}
            startContent={<RotateCcw size={14} />}
          >
            Reset
          </Button>
          <Button
            variant="bordered"
            onPress={load}
            startContent={<RefreshCw size={14} />}
            className="text-foreground border-default-300"
          >
            Refresh
          </Button>
        </div>
      </header>

      {/* Info / explainer box */}
      {showHelp && (
        <Card className="mb-6 bg-content2 border border-divider">
          <CardBody className="p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 w-8 h-8 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                <Info size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold tracking-editorial uppercase text-default-500">
                    What is this page?
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="Dismiss explanation"
                    onPress={dismissHelp}
                    className="text-default-400 hover:text-foreground -mr-2 -mt-1"
                  >
                    <X size={14} />
                  </Button>
                </div>
                <h2 className="font-serif text-xl font-semibold text-foreground mt-1">
                  How product grouping works
                </h2>
                <p className="text-sm text-default-500 mt-2 max-w-3xl leading-relaxed">
                  Different stores write the same product&apos;s title differently
                  (&ldquo;Intel i5 13400&rdquo; vs &ldquo;Intel Core i5-13400 Processor&rdquo;).
                  Grouping clusters those listings into one <span className="text-foreground font-medium">Product</span>{" "}
                  using fuzzy title matching (RapidFuzz · token_set_ratio ≥ 85), so the value score
                  can compare prices apples-to-apples across sites.
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-content1 border border-divider p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Package size={14} className="text-primary" />
                      <span className="text-[11px] font-semibold tracking-editorial uppercase text-default-500">
                        Listings column
                      </span>
                    </div>
                    <p className="text-xs text-default-500 leading-relaxed">
                      Number of scraped rows clustered into this product across <em>all</em> sites.
                      <span className="text-default-600"> Click the number</span> to see every listing
                      on the All listings page, pre-filtered.
                    </p>
                  </div>

                  <div className="rounded-lg bg-content1 border border-divider p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Building2 size={14} className="text-primary" />
                      <span className="text-[11px] font-semibold tracking-editorial uppercase text-default-500">
                        Sites column
                      </span>
                    </div>
                    <p className="text-xs text-default-500 leading-relaxed">
                      Number of <em>distinct</em> stores carrying this product. A
                      <Chip size="sm" variant="flat" color="primary" className="num mx-1 h-5 min-h-5 text-[10px]">
                        2+
                      </Chip>
                      means the value score is meaningful (multi-site comparison).
                    </p>
                  </div>

                  <div className="rounded-lg bg-content1 border border-divider p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles size={14} className="text-primary" />
                      <span className="text-[11px] font-semibold tracking-editorial uppercase text-default-500">
                        How to use
                      </span>
                    </div>
                    <p className="text-xs text-default-500 leading-relaxed">
                      Hit <span className="text-default-600 font-medium">Run grouping</span> after a
                      scrape to cluster new listings. Toggle{" "}
                      <span className="text-default-600 font-medium">Only multi-site</span> to focus on
                      products where price comparison is reliable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Listings" value={stats.total_listings} />
          <StatCard
            label="Grouped"
            value={stats.grouped_listings}
            tone="success"
            sub={`${stats.coverage_pct}%`}
          />
          <StatCard label="Ungrouped" value={stats.ungrouped_listings} tone="warning" />
          <StatCard label="Products" value={stats.total_products} />
          <StatCard label="Multi-site" value={stats.multi_site_products} tone="primary" />
        </div>
      )}

      {lastResult && (
        <Card className="mb-6 bg-primary/5 border border-primary/20">
          <CardBody className="flex-row items-center gap-3 py-3">
            <Spinner size="sm" color="primary" className={running ? "" : "hidden"} />
            <div className="text-sm flex-1">
              <span className="font-medium text-foreground">Last run:</span>{" "}
              <span className="text-default-500">
                processed {lastResult.processed} listings · assigned{" "}
                <span className="text-success font-semibold">{lastResult.assigned_existing}</span>{" "}
                · created{" "}
                <span className="text-primary font-semibold">{lastResult.created_products}</span>{" "}
                new products
                {lastResult.skipped > 0 && ` · ${lastResult.skipped} skipped`}
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-default-500" />
          <span className="text-sm text-default-500">
            Showing {products.length} products
            {onlyMulti ? " that span multiple sites" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-default-500">Only multi-site</span>
          <Switch size="sm" isSelected={onlyMulti} onValueChange={setOnlyMulti} color="primary" />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={10} cols={5} />
      ) : products.length === 0 ? (
        <Card>
          <CardBody className="p-12 text-center">
            <Layers size={28} className="mx-auto text-default-400 mb-3" />
            <div className="font-serif text-xl italic text-default-500 mb-2">
              No products yet.
            </div>
            <p className="text-sm text-default-500">
              Click &ldquo;Run grouping&rdquo; to cluster existing listings into products.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Table
          aria-label="Products"
          removeWrapper
          classNames={{
            base: "bg-content1 rounded-xl border border-divider overflow-hidden",
            th: "text-[11px] font-semibold tracking-[0.14em] uppercase text-default-500 bg-content2 h-10",
            td: "py-3 text-foreground",
            tr: "border-b border-divider last:border-0",
          }}
        >
          <TableHeader>
            <TableColumn width={60}>#</TableColumn>
            <TableColumn>Canonical name</TableColumn>
            <TableColumn width={130}>Brand</TableColumn>
            <TableColumn width={130}>Model</TableColumn>
            <TableColumn width={110} align="end">Listings</TableColumn>
            <TableColumn width={110} align="end">Sites</TableColumn>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const listingsHref = `/admin/listings?product_id=${p.id}&product_name=${encodeURIComponent(
                p.canonical_name
              )}`;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="num text-xs text-default-500">#{p.id}</span>
                  </TableCell>
                  <TableCell>
                    <NextLink
                      href={listingsHref}
                      className="text-sm line-clamp-2 max-w-[520px] hover:text-primary transition-colors"
                    >
                      {p.canonical_name}
                    </NextLink>
                  </TableCell>
                  <TableCell>
                    {p.brand ? (
                      <span className="text-[10px] tracking-editorial uppercase text-default-600">
                        {p.brand}
                      </span>
                    ) : (
                      <span className="text-default-400 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.model ? (
                      <code className="text-xs bg-content2 px-2 py-0.5 rounded font-mono text-default-600">
                        {p.model}
                      </code>
                    ) : (
                      <span className="text-default-400 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip content={`View all ${p.listing_count} listings for this product`} size="sm">
                      <NextLink
                        href={listingsHref}
                        className="num font-medium text-primary hover:underline underline-offset-4"
                      >
                        {p.listing_count}
                      </NextLink>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip
                      content={
                        p.site_count > 1
                          ? `Sold across ${p.site_count} sites — value score is meaningful`
                          : "Only one site carries this product"
                      }
                      size="sm"
                    >
                      <NextLink href={listingsHref}>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={p.site_count > 1 ? "primary" : "default"}
                          className="num font-semibold cursor-pointer hover:opacity-80"
                        >
                          {p.site_count}
                        </Chip>
                      </NextLink>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Modal isOpen={resetModal.isOpen} onOpenChange={resetModal.onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Reset all grouping?</ModalHeader>
              <ModalBody>
                <p className="text-sm">
                  This deletes every Product row and rebuilds the graph from scratch.
                </p>
                <p className="text-xs text-default-500">
                  Use when titles have improved or threshold changed. Safe but slow.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  onPress={() => {
                    resetGrouping();
                    onClose();
                  }}
                >
                  Reset and regroup
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "primary";
  sub?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "primary"
          ? "text-primary"
          : "text-foreground";
  return (
    <Card className="bg-content2 border border-divider">
      <CardBody className="px-5 py-4">
        <div className="text-[10px] font-semibold tracking-editorial uppercase text-default-500 mb-2">
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <div className={`font-serif text-3xl font-semibold tabular-nums ${toneClass}`}>
            {value.toLocaleString("en-IN")}
          </div>
          {sub && <span className="text-xs text-default-500 num">{sub}</span>}
        </div>
      </CardBody>
    </Card>
  );
}
