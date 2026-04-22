"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Input,
  Button,
  Chip,
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Link as HeroLink,
  Progress,
  Spinner,
} from "@heroui/react";
import {
  Search as SearchIcon,
  ExternalLink,
  TrendingDown,
  Radar,
  CheckCircle2,
} from "lucide-react";
import TopNav from "@/components/TopNav";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";

type Result = {
  listing_id: number;
  title: string;
  site: string;
  url: string;
  condition: string;
  price: number;
  currency: string;
  score: number | null;
  scraped_at: string | null;
};

type ScanStatus = {
  total: number;
  done: number;
  running: number;
  failed: number;
  all_done: boolean;
};

const EXAMPLE_QUERIES = ["Samsung SSD", "Ryzen 5 7600", "RTX 4060", "DDR5 RAM", "gaming laptop"];
const MAX_POLL_MS = 90_000;

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [scanRunIds, setScanRunIds] = useState<number[]>([]);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanStartedAt = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  async function runSearch(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setSubmitted(query);
    stopScan();
    try {
      const r = await api.get("/search", { params: { q: query, limit: 100 } });
      setResults(r.data.results);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(q);
  }

  function stopScan() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setScanning(false);
    setScanStatus(null);
    setScanRunIds([]);
  }

  async function startScan() {
    setScanning(true);
    setScanStatus(null);
    scanStartedAt.current = Date.now();
    try {
      const res = await api.post("/search/scan");
      const ids: number[] = res.data.run_ids ?? [];
      setScanRunIds(ids);
      setScanStatus({ total: ids.length, done: 0, running: ids.length, failed: 0, all_done: false });

      pollTimer.current = setInterval(async () => {
        const elapsed = Date.now() - scanStartedAt.current;

        try {
          const [statusRes, searchRes] = await Promise.all([
            api.get("/search/scan/status", { params: { run_ids: ids.join(",") } }),
            api.get("/search", { params: { q: submitted || q, limit: 100 } }),
          ]);
          setScanStatus(statusRes.data);

          if (searchRes.data.results.length > 0) {
            setResults(searchRes.data.results);
          }

          if (statusRes.data.all_done || elapsed > MAX_POLL_MS) {
            // final search fetch
            const finalRes = await api.get("/search", {
              params: { q: submitted || q, limit: 100 },
            });
            setResults(finalRes.data.results);
            stopScan();
          }
        } catch {
          // keep trying until timeout
          if (elapsed > MAX_POLL_MS) stopScan();
        }
      }, 3000);
    } catch {
      setScanning(false);
    }
  }

  const lowest = results?.[0]?.price;

  return (
    <>
      <TopNav />
      <main className="max-w-6xl mx-auto px-6 py-10 md:py-14">
        <section className="mb-10">
          <div className="eyebrow mb-3">Section 02 · Discovery</div>
          <h1 className="font-serif text-5xl font-semibold tracking-tight leading-[1.05]">
            Search <span className="italic text-primary">any product</span>,
            <br />
            compare every seller.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-default-600 leading-relaxed">
            Results are sorted by price, scored against peers on a 5-point value scale.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Samsung SSD, Ryzen 5 7600, RTX 4060…"
              size="lg"
              variant="bordered"
              startContent={<SearchIcon size={18} className="text-default-400" />}
              autoFocus
              classNames={{ input: "text-lg font-serif" }}
            />
            <Button
              type="submit"
              color="primary"
              size="lg"
              isDisabled={!q.trim()}
              isLoading={loading}
            >
              {loading ? "Searching" : "Search"}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Try</span>
            {EXAMPLE_QUERIES.map((ex) => (
              <Chip
                key={ex}
                variant="flat"
                size="sm"
                className="cursor-pointer hover:bg-primary/10 hover:text-primary"
                onClick={() => {
                  setQ(ex);
                  runSearch(ex);
                }}
              >
                {ex}
              </Chip>
            ))}
          </div>
        </form>

        {submitted && !loading && results !== null && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow">Results for</span>
              <span className="font-serif italic text-lg">&quot;{submitted}&quot;</span>
              <span className="text-default-500">· {results.length} matches</span>
            </div>
            {lowest !== undefined && (
              <div className="flex items-center gap-2 text-default-600">
                <TrendingDown size={14} className="text-success" />
                <span>Lowest price:</span>
                <span className="num font-semibold text-success">{formatINR(lowest)}</span>
              </div>
            )}
          </div>
        )}

        {scanning && scanStatus && <ScanBanner status={scanStatus} onStop={stopScan} />}

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : results === null ? (
          <EmptyState />
        ) : results.length === 0 ? (
          <NoResults query={submitted} onScan={startScan} scanning={scanning} />
        ) : (
          <Table
            aria-label="Search results"
            shadow="sm"
            classNames={{
              th: "text-[10px] tracking-editorial uppercase text-default-500 bg-default-50",
              td: "py-3",
            }}
          >
            <TableHeader>
              <TableColumn>#</TableColumn>
              <TableColumn>Product</TableColumn>
              <TableColumn>Site</TableColumn>
              <TableColumn align="end">Price</TableColumn>
              <TableColumn>Score</TableColumn>
              <TableColumn> </TableColumn>
            </TableHeader>
            <TableBody>
              {results.map((r, i) => (
                <TableRow key={r.listing_id}>
                  <TableCell className="num text-xs text-default-400">
                    {String(i + 1).padStart(2, "0")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="leading-tight line-clamp-2 pr-4">{r.title}</span>
                      {r.condition && r.condition !== "new" && (
                        <Chip size="sm" color="warning" variant="flat" className="mt-1 text-[10px]">
                          {r.condition}
                        </Chip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[10px] tracking-editorial uppercase text-default-600">
                      {r.site}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="num text-base font-semibold">{formatINR(r.price)}</span>
                  </TableCell>
                  <TableCell>
                    <ScoreBadge score={r.score} variant="column" />
                  </TableCell>
                  <TableCell>
                    <HeroLink href={r.url} isExternal size="sm" className="inline-flex items-center gap-1 text-xs">
                      Visit
                      <ExternalLink size={11} />
                    </HeroLink>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </main>
    </>
  );
}

function ScanBanner({ status, onStop }: { status: ScanStatus; onStop: () => void }) {
  const pct = status.total === 0 ? 0 : Math.round((status.done / status.total) * 100);
  return (
    <Card shadow="sm" className="mb-6 bg-gradient-to-br from-primary/5 to-transparent border border-primary/20">
      <CardBody className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Spinner size="sm" color="primary" />
            <div>
              <div className="text-sm font-semibold">
                Scanning all marketplaces…
              </div>
              <div className="text-xs text-default-500 mt-0.5">
                {status.done} of {status.total} sites done
                {status.failed > 0 && ` · ${status.failed} failed`}
              </div>
            </div>
          </div>
          <Button size="sm" variant="light" onPress={onStop}>
            Stop
          </Button>
        </div>
        <Progress
          aria-label="Scan progress"
          value={pct}
          color="primary"
          size="sm"
          classNames={{ indicator: "bg-primary" }}
        />
      </CardBody>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card shadow="sm">
      <CardBody className="p-16 text-center">
        <div className="font-serif text-2xl text-default-600 italic mb-2">
          Type above to begin.
        </div>
        <p className="text-sm text-default-500 max-w-sm mx-auto">
          Every query hits the live index of scraped listings across all enabled sites.
        </p>
      </CardBody>
    </Card>
  );
}

function NoResults({
  query,
  onScan,
  scanning,
}: {
  query: string;
  onScan: () => void;
  scanning: boolean;
}) {
  return (
    <Card shadow="sm">
      <CardBody className="p-12 text-center">
        <div className="font-serif text-xl italic text-default-600 mb-2">
          Nothing indexed yet for &quot;{query}&quot;.
        </div>
        <p className="text-sm text-default-500 mb-6 max-w-md mx-auto">
          The index is empty for this query. Trigger a live scan across every enabled site —
          results will appear here as they come in.
        </p>
        <Button
          color="primary"
          size="lg"
          onPress={onScan}
          isDisabled={scanning}
          startContent={scanning ? <Spinner size="sm" color="white" /> : <Radar size={16} />}
        >
          {scanning ? "Scanning marketplaces…" : "Scan every marketplace now"}
        </Button>
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-default-400">
          <CheckCircle2 size={12} />
          Typically takes 30–90 seconds
        </div>
      </CardBody>
    </Card>
  );
}
