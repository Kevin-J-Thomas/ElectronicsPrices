"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
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
  Code,
  Chip,
} from "@heroui/react";
import { Plus, Pencil, Clock } from "lucide-react";
import { adminApi } from "@/lib/api";
import { relativeTime } from "@/lib/utils";
import { EnabledDot } from "@/components/ui/StatusPill";
import { TableSkeleton } from "@/components/ui/Skeleton";

type Job = {
  id: number;
  name: string;
  cron_expression: string;
  site_id: number | null;
  enabled: boolean;
  last_status: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
};

type Site = { id: number; name: string };

export default function SchedulePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sitesMap, setSitesMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.get<Job[]>("/admin/schedule"),
      adminApi.get<Site[]>("/admin/sites"),
    ]).then(([j, s]) => {
      setJobs(j.data);
      setSitesMap(new Map(s.data.map((x) => [x.id, x.name])));
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow mb-2">Admin · Scheduler</div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            Scheduled jobs
          </h1>
          <p className="mt-1 text-default-500 text-sm">
            Cron jobs that fire scrapes automatically.
          </p>
        </div>
        <Button
          as={NextLink}
          href="/admin/schedule/new"
          color="primary"
          startContent={<Plus size={14} />}
        >
          Add job
        </Button>
      </header>

      {loading ? (
        <TableSkeleton rows={3} cols={5} />
      ) : jobs.length === 0 ? (
        <Card shadow="sm">
          <CardBody className="p-12 text-center">
            <Clock size={24} className="mx-auto text-default-400 mb-3" />
            <div className="font-serif text-xl italic text-default-500 mb-2">
              No scheduled jobs yet.
            </div>
            <p className="text-sm text-default-500 mb-4">
              Create one to run scrapes automatically.
            </p>
            <Button
              as={NextLink}
              href="/admin/schedule/new"
              color="primary"
              startContent={<Plus size={14} />}
              className="mx-auto"
            >
              Create job
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Table
          aria-label="Scheduled jobs"
          shadow="sm"
          classNames={{ th: "text-[10px] tracking-editorial uppercase bg-default-100" }}
        >
          <TableHeader>
            <TableColumn>Job</TableColumn>
            <TableColumn>Cron</TableColumn>
            <TableColumn>Target</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Next run</TableColumn>
            <TableColumn align="end">Actions</TableColumn>
          </TableHeader>
          <TableBody>
            {jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="font-medium">{j.name}</TableCell>
                <TableCell>
                  <Code size="sm">{j.cron_expression}</Code>
                </TableCell>
                <TableCell>
                  {j.site_id ? (
                    <span>{sitesMap.get(j.site_id) ?? `Site #${j.site_id}`}</span>
                  ) : (
                    <Chip size="sm" color="primary" variant="flat">
                      All enabled sites
                    </Chip>
                  )}
                </TableCell>
                <TableCell>
                  <EnabledDot enabled={j.enabled} />
                </TableCell>
                <TableCell className="text-xs text-default-500">
                  {relativeTime(j.next_run_at)}
                </TableCell>
                <TableCell>
                  <Button
                    as={NextLink}
                    href={`/admin/schedule/${j.id}`}
                    size="sm"
                    variant="light"
                    startContent={<Pencil size={11} />}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
