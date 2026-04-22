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
} from "@heroui/react";
import { History, AlertCircle, RefreshCw } from "lucide-react";
import { adminApi } from "@/lib/api";
import { formatNumber, relativeTime } from "@/lib/utils";
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

type Site = { id: number; name: string };

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [sitesMap, setSitesMap] = useState<Map<number, string>>(new Map());
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const stats = {
    total: runs.length,
    success: runs.filter((r) => r.status === "success").length,
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Summary label="Shown" value={formatNumber(stats.total)} />
        <Summary label="Success" value={formatNumber(stats.success)} tone="success" />
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
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <span className="num text-xs text-default-500">#{r.id}</span>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-foreground">
                    {sitesMap.get(r.site_id) ?? `Site #${r.site_id}`}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusPill status={r.status} />
                </TableCell>
                <TableCell className="num text-right font-medium">
                  {formatNumber(r.items_scraped)}
                </TableCell>
                <TableCell className="num text-right">
                  {r.items_new > 0 ? (
                    <span className="text-success font-semibold">+{r.items_new}</span>
                  ) : (
                    <span className="text-default-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-default-500">{relativeTime(r.started_at)}</span>
                </TableCell>
                <TableCell className="max-w-md">
                  {r.error_message ? (
                    <div className="flex items-start gap-1.5 text-xs text-danger">
                      <AlertCircle size={12} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{r.error_message}</span>
                    </div>
                  ) : (
                    <span className="text-default-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
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
