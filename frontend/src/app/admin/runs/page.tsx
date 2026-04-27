"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardBody,
  Tabs,
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
  Chip,
  Tooltip,
} from "@heroui/react";
import {
  History,
  AlertCircle,
  RefreshCw,
  FileText,
  Copy,
  Check,
  Clock,
  Calendar,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { formatNumber, relativeTime, parseUTC } from "@/lib/utils";
import { StatusPill } from "@/components/ui/StatusPill";
import { TableSkeleton } from "@/components/ui/Skeleton";

type Run = {
  id: number;
  site_id: number;
  job_id: number | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_scraped: number;
  items_new: number;
  items_updated: number;
  error_message: string | null;
};

type RunDetail = Run & {
  log_output: string | null;
  site_name: string | null;
};

type Site = { id: number; name: string };

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = parseUTC(end).getTime() - parseUTC(start).getTime();
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return parseUTC(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [sitesMap, setSitesMap] = useState<Map<number, string>>(new Map());
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const detailModal = useDisclosure();
  const [activeRun, setActiveRun] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    const params: Record<string, string> = { limit: "100" };
    if (statusFilter !== "all") params.status = statusFilter;
    const [runsRes, sitesRes] = await Promise.all([
      adminApi.get<Run[]>("/admin/runs", { params }),
      adminApi.get<Site[]>("/admin/sites"),
    ]);
    setRuns(runsRes.data);
    setSitesMap(new Map(sitesRes.data.map((x) => [x.id, x.name])));
    setLoading(false);
  }

  async function openRun(run: Run) {
    setActiveRun(null);
    setCopied(false);
    detailModal.onOpen();
    setDetailLoading(true);
    try {
      const r = await adminApi.get<RunDetail>(`/admin/runs/${run.id}`);
      setActiveRun(r.data);
    } finally {
      setDetailLoading(false);
    }
  }

  async function copyLogs() {
    if (!activeRun) return;
    const text = [
      `Run #${activeRun.id} — ${activeRun.site_name ?? `Site #${activeRun.site_id}`}`,
      `Status: ${activeRun.status}`,
      `Started:  ${formatTimestamp(activeRun.started_at)}`,
      `Finished: ${formatTimestamp(activeRun.finished_at)}`,
      `Duration: ${formatDuration(activeRun.started_at, activeRun.finished_at)}`,
      `Items: scraped=${activeRun.items_scraped} new=${activeRun.items_new} updated=${activeRun.items_updated}`,
      "",
      activeRun.error_message ? `ERROR: ${activeRun.error_message}\n` : "",
      activeRun.log_output ?? "(no log output captured)",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const stats = {
    total: runs.length,
    success: runs.filter((r) => r.status === "success").length,
    skipped: runs.filter((r) => r.status === "skipped").length,
    failed: runs.filter((r) => r.status === "failed").length,
    totalItems: runs.reduce((a, r) => a + r.items_scraped, 0),
  };

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[11px] font-semibold tracking-editorial uppercase text-default-500 mb-2">
            Admin · History
          </div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
            Run history
          </h1>
          <p className="mt-1 text-default-500 text-sm">Recent scrape executions.</p>
        </div>
        <Button
          variant="bordered"
          color="default"
          onPress={load}
          startContent={<RefreshCw size={14} />}
          className="text-foreground border-default-300"
        >
          Refresh
        </Button>
      </header>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Summary label="Shown" value={formatNumber(stats.total)} />
        <Summary label="Success" value={formatNumber(stats.success)} tone="success" />
        <Summary label="Skipped" value={formatNumber(stats.skipped)} />
        <Summary label="Failed" value={formatNumber(stats.failed)} tone="danger" />
        <Summary label="Items scraped" value={formatNumber(stats.totalItems)} />
      </div>

      {/* Filter tabs */}
      <div className="mb-5">
        <Tabs
          aria-label="Run filter"
          color="primary"
          variant="solid"
          size="md"
          selectedKey={statusFilter}
          onSelectionChange={(k) => setStatusFilter(String(k))}
          classNames={{
            tabList: "bg-content2 p-1",
            tab: "text-default-500 data-[selected=true]:text-white px-4 h-9",
            cursor: "bg-primary",
          }}
        >
          <Tab key="all" title="All" />
          <Tab key="success" title="Success" />
          <Tab key="skipped" title="Skipped" />
          <Tab key="failed" title="Failed" />
          <Tab key="running" title="Running" />
        </Tabs>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : runs.length === 0 ? (
        <Card>
          <CardBody className="p-12 text-center">
            <History size={24} className="mx-auto text-default-400 mb-3" />
            <div className="font-serif text-xl italic text-default-500">
              No scrape runs{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
            </div>
            <p className="text-sm text-default-500 mt-2">
              Trigger a scrape from the Sites page to see activity here.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Table
          aria-label="Run history"
          removeWrapper
          classNames={{
            base: "bg-content1 rounded-xl border border-divider overflow-hidden",
            th: "text-[11px] font-semibold tracking-[0.14em] uppercase text-default-500 bg-content2 h-10",
            td: "py-3.5 text-foreground",
            tr: "border-b border-divider last:border-0",
          }}
        >
          <TableHeader>
            <TableColumn width={72}>Run</TableColumn>
            <TableColumn>Site</TableColumn>
            <TableColumn width={120}>Status</TableColumn>
            <TableColumn width={90} align="end">Items</TableColumn>
            <TableColumn width={80} align="end">New</TableColumn>
            <TableColumn width={120}>Started</TableColumn>
            <TableColumn>Error</TableColumn>
            <TableColumn width={90} align="end">Logs</TableColumn>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer hover:bg-content2/60 transition-colors"
              >
                <TableCell onClick={() => openRun(r)}>
                  <span className="num text-xs text-default-500">#{r.id}</span>
                </TableCell>
                <TableCell onClick={() => openRun(r)}>
                  <span className="font-medium text-foreground">
                    {sitesMap.get(r.site_id) ?? `Site #${r.site_id}`}
                  </span>
                </TableCell>
                <TableCell onClick={() => openRun(r)}>
                  <StatusPill status={r.status} />
                </TableCell>
                <TableCell className="num text-right font-medium" onClick={() => openRun(r)}>
                  {formatNumber(r.items_scraped)}
                </TableCell>
                <TableCell className="num text-right" onClick={() => openRun(r)}>
                  {r.items_new > 0 ? (
                    <span className="text-success font-semibold">+{r.items_new}</span>
                  ) : (
                    <span className="text-default-400">—</span>
                  )}
                </TableCell>
                <TableCell onClick={() => openRun(r)}>
                  <Tooltip content={formatTimestamp(r.started_at)} size="sm">
                    <span className="text-xs text-default-500">{relativeTime(r.started_at)}</span>
                  </Tooltip>
                </TableCell>
                <TableCell className="max-w-md" onClick={() => openRun(r)}>
                  {r.error_message ? (
                    <div className="flex items-start gap-1.5 text-xs text-danger">
                      <AlertCircle size={12} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{r.error_message}</span>
                    </div>
                  ) : (
                    <span className="text-default-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Tooltip content="View full logs" size="sm">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label="View logs"
                        onPress={() => openRun(r)}
                        className="text-default-500 hover:text-primary"
                      >
                        <FileText size={14} />
                      </Button>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Run detail modal */}
      <Modal
        isOpen={detailModal.isOpen}
        onOpenChange={detailModal.onOpenChange}
        size="4xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-content1",
          header: "border-b border-divider",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-editorial uppercase text-default-500">
                  Run #{activeRun?.id ?? "…"} · scrape log
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-serif text-2xl font-semibold text-foreground">
                    {activeRun?.site_name ?? "Loading…"}
                  </span>
                  {activeRun && <StatusPill status={activeRun.status} />}
                </div>
              </ModalHeader>
              <ModalBody className="py-5">
                {detailLoading || !activeRun ? (
                  <div className="flex items-center justify-center py-16">
                    <Spinner size="lg" color="primary" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {/* Meta grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MetaCell
                        icon={<Calendar size={12} />}
                        label="Started"
                        value={formatTimestamp(activeRun.started_at)}
                      />
                      <MetaCell
                        icon={<Calendar size={12} />}
                        label="Finished"
                        value={formatTimestamp(activeRun.finished_at)}
                      />
                      <MetaCell
                        icon={<Clock size={12} />}
                        label="Duration"
                        value={formatDuration(activeRun.started_at, activeRun.finished_at)}
                      />
                      <MetaCell
                        label="Job"
                        value={activeRun.job_id ? `#${activeRun.job_id}` : "manual / search"}
                      />
                    </div>

                    {/* Item counts */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip size="sm" variant="flat" className="num">
                        Scraped {formatNumber(activeRun.items_scraped)}
                      </Chip>
                      <Chip size="sm" variant="flat" color="success" className="num">
                        New {formatNumber(activeRun.items_new)}
                      </Chip>
                      <Chip size="sm" variant="flat" color="primary" className="num">
                        Updated {formatNumber(activeRun.items_updated)}
                      </Chip>
                    </div>

                    {/* Error message */}
                    {activeRun.error_message && (
                      <div className="rounded-lg bg-danger/10 border border-danger/30 p-4">
                        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-editorial uppercase text-danger mb-1.5">
                          <AlertCircle size={12} />
                          Error
                        </div>
                        <pre className="text-sm text-danger whitespace-pre-wrap break-words font-mono">
                          {activeRun.error_message}
                        </pre>
                      </div>
                    )}

                    {/* Log output */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[11px] font-semibold tracking-editorial uppercase text-default-500">
                          Captured logs
                        </div>
                        <Button
                          size="sm"
                          variant="flat"
                          startContent={
                            copied ? <Check size={12} /> : <Copy size={12} />
                          }
                          onPress={copyLogs}
                          color={copied ? "success" : "default"}
                        >
                          {copied ? "Copied" : "Copy all"}
                        </Button>
                      </div>
                      {activeRun.log_output ? (
                        <pre className="text-[11px] leading-relaxed font-mono bg-content2 border border-divider rounded-lg p-4 whitespace-pre-wrap break-words text-default-600 max-h-[420px] overflow-auto">
                          {activeRun.log_output}
                        </pre>
                      ) : (
                        <div className="text-xs text-default-500 italic px-4 py-3 bg-content2 border border-divider rounded-lg">
                          No log output captured for this run. Older runs (before log
                          capture was added) will be empty.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

function MetaCell({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-content2 border border-divider p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-editorial uppercase text-default-500 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-sm text-foreground num truncate">{value}</div>
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <Card className="bg-content2 border border-divider">
      <CardBody className="px-5 py-4">
        <div className="text-[10px] font-semibold tracking-editorial uppercase text-default-500 mb-2">
          {label}
        </div>
        <div className={`font-serif text-3xl font-semibold tabular-nums ${toneClass}`}>
          {value}
        </div>
      </CardBody>
    </Card>
  );
}
