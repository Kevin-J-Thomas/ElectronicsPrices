"use client";

import { FormEvent, useEffect, useState } from "react";
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
  { label: "Every day at 6 AM", value: "0 6 * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 15 minutes (testing)", value: "*/15 * * * *" },
];

export default function ScheduleForm({ initial, onSubmit, submitLabel }: Props) {
  const [values, setValues] = useState<ScheduleFormValues>(initial);
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.get<Site[]>("/admin/sites").then((r) => setSites(r.data));
  }, []);

  function update<K extends keyof ScheduleFormValues>(key: K, val: ScheduleFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
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

  const label = "block text-sm font-medium text-gray-700 mb-1";
  const input =
    "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow max-w-2xl space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className={label}>Job name *</label>
        <input
          className={input}
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Daily scrape - all sites"
        />
      </div>

      <div>
        <label className={label}>Target site</label>
        <select
          className={input}
          value={values.site_id ?? ""}
          onChange={(e) =>
            update("site_id", e.target.value ? parseInt(e.target.value, 10) : null)
          }
        >
          <option value="">All enabled sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Leave as "All enabled sites" to scrape everything at once.
        </p>
      </div>

      <div>
        <label className={label}>Cron expression *</label>
        <input
          className={`${input} font-mono`}
          required
          value={values.cron_expression}
          onChange={(e) => update("cron_expression", e.target.value)}
          placeholder="0 6 * * *"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {CRON_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => update("cron_expression", p.value)}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Format: <code className="bg-gray-100 px-1">min hour day month day-of-week</code>
        </p>
      </div>

      <div>
        <label className={label}>Timezone</label>
        <input
          className={input}
          value={values.timezone}
          onChange={(e) => update("timezone", e.target.value)}
          placeholder="Asia/Kolkata"
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.enabled}
          onChange={(e) => update("enabled", e.target.checked)}
        />
        <span>Enabled</span>
      </label>

      <div className="pt-4 border-t">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Note: after adding or editing a job, restart the beat container for changes to take effect:
        <br />
        <code className="bg-gray-100 px-1">docker compose restart beat</code>
      </p>
    </form>
  );
}
