"use client";

import { useState } from "react";
import {
  Input,
  Button,
  Card,
  CardBody,
  CardHeader,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Link as HeroLink,
  Chip,
  Divider,
} from "@heroui/react";
import { Plus, X, ExternalLink, Calculator, CheckCircle2 } from "lucide-react";
import TopNav from "@/components/TopNav";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";

type OrderItem = {
  query: string;
  chosen_site: string;
  title: string;
  price: number;
  currency: string;
  link: string;
  score: number | null;
};

type LowestResult = {
  items: OrderItem[];
  total: number;
  currency: string;
  missing: string[];
};

type SiteEntry = {
  price: number;
  currency: string;
  link: string;
  title: string;
  score: number | null;
  condition: string;
};
type Coverage = Record<string, Record<string, SiteEntry>>;

const STARTER_ITEMS = ["Samsung SSD", "WD 1TB HDD", "AMD Ryzen 5"];

export default function OrdersPage() {
  const [items, setItems] = useState<string[]>(STARTER_ITEMS);
  const [lowest, setLowest] = useState<LowestResult | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(false);

  function updateItem(i: number, v: string) {
    setItems(items.map((x, idx) => (idx === i ? v : x)));
  }
  function addItem() {
    setItems([...items, ""]);
  }
  function removeItem(i: number) {
    if (items.length === 1) {
      setItems([""]);
      return;
    }
    setItems(items.filter((_, idx) => idx !== i));
  }

  async function generateOrder() {
    const payload = { items: items.map((s) => s.trim()).filter(Boolean) };
    if (payload.items.length === 0) return;
    setLoading(true);
    try {
      const [lRes, cRes] = await Promise.all([
        api.post("/orders/lowest-cost", payload),
        api.post("/orders/coverage", payload),
      ]);
      setLowest(lRes.data);
      setCoverage(cRes.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopNav />
      <main className="max-w-6xl mx-auto px-6 py-10 md:py-14">
        <section className="mb-10">
          <div className="eyebrow mb-3">Section 03 · Procurement</div>
          <h1 className="font-serif text-5xl font-semibold tracking-tight leading-[1.05]">
            Build a list.
            <br />
            <span className="italic text-primary">We&apos;ll find the cheapest route.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-default-600 leading-relaxed">
            Enter what you&apos;re shopping for. The engine searches every site and returns the
            lowest-cost combination, plus a per-site coverage map.
          </p>
        </section>

        <div className="grid md:grid-cols-[1fr_auto] gap-6 mb-10">
          <Card shadow="sm">
            <CardHeader className="flex items-center justify-between">
              <div className="eyebrow">Your order list</div>
              <span className="num text-xs text-default-500">
                {items.filter((i) => i.trim()).length} / {items.length} items
              </span>
            </CardHeader>
            <CardBody className="gap-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="num text-xs text-default-400 w-8 text-right">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Input
                    value={item}
                    onChange={(e) => updateItem(i, e.target.value)}
                    placeholder="e.g. Samsung SSD 128GB Sata"
                    variant="bordered"
                    size="sm"
                  />
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    color="danger"
                    onPress={() => removeItem(i)}
                    aria-label="Remove"
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))}
              <Divider className="my-2" />
              <div className="flex items-center justify-between">
                <Button variant="light" size="sm" startContent={<Plus size={14} />} onPress={addItem}>
                  Add item
                </Button>
                <Button
                  color="primary"
                  onPress={generateOrder}
                  isLoading={loading}
                  startContent={!loading && <Calculator size={14} />}
                >
                  {loading ? "Calculating" : "Calculate cheapest"}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card
            shadow="sm"
            className="w-full md:w-80 relative overflow-hidden bg-gradient-to-br from-background to-primary/5"
          >
            <span className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
            <CardBody className="p-8 justify-center">
              <div className="eyebrow mb-2">Cheapest total</div>
              {loading ? (
                <Skeleton className="h-14 w-40" />
              ) : lowest ? (
                <>
                  <div className="font-serif text-5xl font-semibold num tracking-tight">
                    {formatINR(lowest.total)}
                  </div>
                  <div className="mt-3 text-sm text-default-600">
                    across {new Set(lowest.items.map((i) => i.chosen_site)).size} sites ·{" "}
                    {lowest.items.length} items matched
                  </div>
                  {lowest.missing.length > 0 && (
                    <Chip size="sm" color="warning" variant="flat" className="mt-3">
                      {lowest.missing.length} not found: {lowest.missing.join(", ")}
                    </Chip>
                  )}
                </>
              ) : (
                <div className="text-default-400 italic">— no total yet —</div>
              )}
            </CardBody>
          </Card>
        </div>

        {lowest && lowest.items.length > 0 && (
          <section className="mb-10">
            <div className="mb-4">
              <div className="eyebrow mb-1 flex items-center gap-2">
                <CheckCircle2 size={10} className="text-success" />
                Cheapest pick per item
              </div>
              <h2 className="font-serif text-2xl font-semibold tracking-tight">
                Your winning combination
              </h2>
            </div>
            <Table
              aria-label="Winning combination"
              shadow="sm"
              classNames={{ th: "text-[10px] tracking-editorial uppercase bg-default-50" }}
            >
              <TableHeader>
                <TableColumn>#</TableColumn>
                <TableColumn>Request</TableColumn>
                <TableColumn>Matched</TableColumn>
                <TableColumn>Site</TableColumn>
                <TableColumn>Score</TableColumn>
                <TableColumn align="end">Price</TableColumn>
                <TableColumn> </TableColumn>
              </TableHeader>
              <TableBody>
                {lowest.items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell className="num text-xs text-default-400">
                      {String(i + 1).padStart(2, "0")}
                    </TableCell>
                    <TableCell className="font-medium">{it.query}</TableCell>
                    <TableCell className="text-sm text-default-600">
                      <span className="line-clamp-1">{it.title}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] tracking-editorial uppercase text-default-600">
                        {it.chosen_site}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ScoreBadge score={it.score} variant="compact" />
                    </TableCell>
                    <TableCell className="num font-semibold">{formatINR(it.price)}</TableCell>
                    <TableCell>
                      <HeroLink href={it.link} isExternal size="sm">
                        <ExternalLink size={11} />
                      </HeroLink>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-end gap-4">
              <span className="eyebrow">Total</span>
              <span className="num font-serif text-2xl font-semibold">
                {formatINR(lowest.total)}
              </span>
            </div>
          </section>
        )}

        {coverage && (
          <section>
            <div className="eyebrow mb-2">Per-spec evaluation</div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight mb-1">
              Coverage across sites
            </h2>
            <p className="text-sm text-default-600 mb-6">
              Every site that stocks each item, with price + score + link.
            </p>

            <div className="space-y-6">
              {Object.entries(coverage).map(([query, sites]) => {
                const siteList = Object.entries(sites).sort((a, b) => a[1].price - b[1].price);
                return (
                  <Card key={query} shadow="sm">
                    <CardHeader className="flex items-center justify-between border-b border-divider">
                      <h3 className="font-serif text-lg font-semibold italic">{query}</h3>
                      <span className="text-[10px] tracking-editorial uppercase text-default-500">
                        {siteList.length} site{siteList.length !== 1 ? "s" : ""}
                      </span>
                    </CardHeader>
                    <CardBody className="p-0">
                      {siteList.length === 0 ? (
                        <div className="px-5 py-6 text-sm text-default-400 italic">
                          No site stocks this.
                        </div>
                      ) : (
                        <Table aria-label={`Coverage for ${query}`} removeWrapper>
                          <TableHeader>
                            <TableColumn>Site</TableColumn>
                            <TableColumn>Price</TableColumn>
                            <TableColumn>Score</TableColumn>
                            <TableColumn>Title</TableColumn>
                            <TableColumn> </TableColumn>
                          </TableHeader>
                          <TableBody>
                            {siteList.map(([site, entry], i) => (
                              <TableRow key={site}>
                                <TableCell>
                                  <span className="text-[10px] tracking-editorial uppercase text-default-600">
                                    {site}
                                  </span>
                                </TableCell>
                                <TableCell className="num font-semibold">
                                  {formatINR(entry.price)}
                                  {i === 0 && (
                                    <Chip
                                      size="sm"
                                      color="success"
                                      variant="flat"
                                      className="ml-2"
                                    >
                                      Lowest
                                    </Chip>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <ScoreBadge score={entry.score} variant="compact" />
                                </TableCell>
                                <TableCell className="text-sm text-default-600">
                                  <span className="line-clamp-1">{entry.title}</span>
                                </TableCell>
                                <TableCell>
                                  <HeroLink href={entry.link} isExternal size="sm">
                                    <ExternalLink size={11} />
                                  </HeroLink>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
