"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Card,
  CardBody,
  Link as HeroLink,
  Tooltip,
} from "@heroui/react";
import { Plus, Play, Pencil, ExternalLink, Search } from "lucide-react";
import { adminApi } from "@/lib/api";
import { relativeTime } from "@/lib/utils";
import { EnabledDot, StatusPill } from "@/components/ui/StatusPill";
import { TableSkeleton } from "@/components/ui/Skeleton";

type Site = {
  id: number;
  name: string;
  base_url: string;
  scraper_type: string;
  enabled: boolean;
  last_status: string | null;
  last_run_at: string | null;
  requires_location: boolean;
  categories?: string[];
};

const TYPE_COLORS: Record<string, "default" | "primary" | "success" | "warning"> = {
  static: "default",
  dynamic: "primary",
  api: "success",
  location: "warning",
};

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [running, setRunning] = useState<Set<number>>(new Set());

  useEffect(() => {
    adminApi.get<Site[]>("/admin/sites").then((r) => {
      setSites(r.data);
      setLoading(false);
    });
  }, []);

  async function runNow(id: number) {
    setRunning((s) => new Set(s).add(id));
    try {
      await adminApi.post(`/admin/sites/${id}/run`);
    } finally {
      setTimeout(() => {
        setRunning((s) => {
          const copy = new Set(s);
          copy.delete(id);
          return copy;
        });
      }, 1500);
    }
  }

  const filtered = sites.filter((s) =>
    !filter
      ? true
      : s.name.toLowerCase().includes(filter.toLowerCase()) ||
        s.base_url.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow mb-2">Admin · Sites</div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            Configured sites
          </h1>
          <p className="mt-1 text-default-500 text-sm">
            {sites.length} total, {sites.filter((s) => s.enabled).length} enabled
          </p>
        </div>
        <Button
          as={NextLink}
          href="/admin/sites/new"
          color="primary"
          startContent={<Plus size={14} />}
        >
          Add site
        </Button>
      </header>

      <div className="mb-4 max-w-sm">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or URL…"
          startContent={<Search size={14} className="text-default-400" />}
          variant="bordered"
          size="sm"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : filtered.length === 0 ? (
        <Card shadow="sm">
          <CardBody className="p-12 text-center">
            <div className="font-serif text-xl italic text-default-500 mb-2">
              {sites.length === 0
                ? "No sites configured yet."
                : `No matches for "${filter}".`}
            </div>
            {sites.length === 0 && (
              <Button
                as={NextLink}
                href="/admin/sites/new"
                color="primary"
                startContent={<Plus size={14} />}
                className="mt-4 mx-auto"
              >
                Add your first site
              </Button>
            )}
          </CardBody>
        </Card>
      ) : (
        <Table
          aria-label="Sites"
          shadow="sm"
          classNames={{ th: "text-[10px] tracking-editorial uppercase bg-default-100" }}
        >
          <TableHeader>
            <TableColumn>Site</TableColumn>
            <TableColumn>Type</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Last run</TableColumn>
            <TableColumn>Last status</TableColumn>
            <TableColumn align="end">Actions</TableColumn>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium flex items-center gap-2">
                      {s.name}
                      {s.requires_location && (
                        <Chip size="sm" color="warning" variant="flat" className="text-[10px]">
                          Location
                        </Chip>
                      )}
                    </span>
                    <HeroLink
                      href={s.base_url}
                      isExternal
                      size="sm"
                      className="text-xs inline-flex items-center gap-1 mt-0.5 max-w-[280px] truncate"
                    >
                      {s.base_url.replace(/^https?:\/\//, "")}
                      <ExternalLink size={10} className="shrink-0" />
                    </HeroLink>
                  </div>
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    color={TYPE_COLORS[s.scraper_type] ?? "default"}
                    variant="flat"
                    className="text-[10px] tracking-editorial uppercase"
                  >
                    {s.scraper_type}
                  </Chip>
                </TableCell>
                <TableCell>
                  <EnabledDot enabled={s.enabled} />
                </TableCell>
                <TableCell className="text-xs text-default-500">
                  {relativeTime(s.last_run_at)}
                </TableCell>
                <TableCell>
                  <StatusPill status={s.last_status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip content="Trigger scrape now">
                      <Button
                        size="sm"
                        variant="light"
                        color="success"
                        isLoading={running.has(s.id)}
                        startContent={!running.has(s.id) && <Play size={11} />}
                        onPress={() => runNow(s.id)}
                      >
                        {running.has(s.id) ? "Queued" : "Run"}
                      </Button>
                    </Tooltip>
                    <Button
                      as={NextLink}
                      href={`/admin/sites/${s.id}`}
                      size="sm"
                      variant="light"
                      startContent={<Pencil size={11} />}
                    >
                      Edit
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
