"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Input,
  Select,
  SelectItem,
  Switch,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
} from "@heroui/react";
import { AlertCircle, Info } from "lucide-react";
import { adminApi } from "@/lib/api";

export type ScheduleFormValues = {
  name: string;
  site_id: number | null;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
};

type Site = { id: number; name: string };

type Props = {
  initial: ScheduleFormValues;
  onSubmit: (values: ScheduleFormValues) => Promise<void>;
  submitLabel: string;
};

const CRON_PRESETS = [
  { label: "Every day · 6 AM", value: "0 6 * * *" },
  { label: "Every day · midnight", value: "0 0 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 15 min (testing)", value: "*/15 * * * *" },
];

export default function ScheduleForm({ initial, onSubmit, submitLabel }: Props) {
  const [values, setValues] = useState<ScheduleFormValues>(initial);
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.get<Site[]>("/admin/sites").then((r) => setSites(r.data));
  }, []);

  function update<K extends keyof ScheduleFormValues>(k: K, v: ScheduleFormValues[K]) {
    setValues((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Request failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
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
          <div className="eyebrow">Job details</div>
          <p className="text-xs text-default-500 mt-1">Name this job and pick its target.</p>
        </CardHeader>
        <CardBody className="gap-5">
          <Input
            label="Name"
            isRequired
            variant="bordered"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Daily scrape — all sites"
          />
          <Select
            label="Target site"
            variant="bordered"
            selectedKeys={values.site_id ? [String(values.site_id)] : ["all"]}
            onChange={(e) =>
              update("site_id", e.target.value === "all" ? null : parseInt(e.target.value, 10))
            }
            description='Leave on "All enabled sites" to scrape everything in parallel.'
          >
            <SelectItem key="all">All enabled sites</SelectItem>
            <>
              {sites.map((s) => (
                <SelectItem key={String(s.id)}>{s.name}</SelectItem>
              ))}
            </>
          </Select>
        </CardBody>
      </Card>

      <Card shadow="sm">
        <CardHeader className="flex-col items-start">
          <div className="eyebrow">Schedule</div>
          <p className="text-xs text-default-500 mt-1">
            Cron expression controls when this fires.
          </p>
        </CardHeader>
        <CardBody className="gap-5">
          <Input
            label="Cron expression"
            isRequired
            variant="bordered"
            value={values.cron_expression}
            onChange={(e) => update("cron_expression", e.target.value)}
            classNames={{ input: "font-mono" }}
            placeholder="0 6 * * *"
            description="min  hour  dom  month  dow"
          />
          <div className="flex flex-wrap gap-1.5">
            {CRON_PRESETS.map((p) => (
              <Chip
                key={p.value}
                variant={values.cron_expression === p.value ? "solid" : "flat"}
                color={values.cron_expression === p.value ? "primary" : "default"}
                className="cursor-pointer"
                onClick={() => update("cron_expression", p.value)}
              >
                {p.label}
              </Chip>
            ))}
          </div>
          <Input
            label="Timezone"
            variant="bordered"
            value={values.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            placeholder="Asia/Kolkata"
          />

          <Card shadow="none" className="border border-divider">
            <CardBody className="flex-row items-start justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-medium">Enabled</div>
                <div className="text-xs text-default-500 mt-0.5">
                  Job will fire on schedule when enabled.
                </div>
              </div>
              <Switch
                isSelected={values.enabled}
                onValueChange={(v) => update("enabled", v)}
                color="primary"
                size="sm"
              />
            </CardBody>
          </Card>
        </CardBody>
      </Card>

      <Card className="border border-warning/30 bg-warning/5">
        <CardBody className="flex-row items-start gap-2 text-xs">
          <Info size={14} className="mt-0.5 shrink-0 text-warning" />
          <span className="text-default-600">
            After adding/editing a job, restart the beat container to pick up changes:{" "}
            <code className="mx-1 px-1.5 py-0.5 bg-default-100 rounded font-mono text-[10px]">
              docker compose restart beat
            </code>
          </span>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" color="primary" size="lg" isLoading={saving}>
          {saving ? "Saving" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
