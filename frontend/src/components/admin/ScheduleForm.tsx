"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";

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
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Request failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-md bg-crimson/5 border border-crimson/20 text-sm text-crimson">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="card p-6 shadow-soft space-y-5">
        <div>
          <div className="eyebrow mb-1">Job details</div>
          <p className="text-xs text-ink-faint">Name this job and pick its target.</p>
        </div>

        <div>
          <label className="field-label">Name<span className="text-sienna ml-1">*</span></label>
          <input
            className="input"
            required
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Daily scrape — all sites"
          />
        </div>

        <div>
          <label className="field-label">Target site</label>
          <select
            className="input"
            value={values.site_id ?? ""}
            onChange={(e) => update("site_id", e.target.value ? parseInt(e.target.value, 10) : null)}
          >
            <option value="">All enabled sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <p className="text-xs text-ink-faint mt-1.5">
            Leave on &ldquo;All enabled sites&rdquo; to scrape everything in parallel.
          </p>
        </div>
      </section>

      <section className="card p-6 shadow-soft space-y-5">
        <div>
          <div className="eyebrow mb-1">Schedule</div>
          <p className="text-xs text-ink-faint">Cron expression controls when this fires.</p>
        </div>

        <div>
          <label className="field-label">Cron expression<span className="text-sienna ml-1">*</span></label>
          <input
            className="input font-mono"
            required
            value={values.cron_expression}
            onChange={(e) => update("cron_expression", e.target.value)}
            placeholder="0 6 * * *"
          />
          <div className="flex flex-wrap gap-1.5 mt-3">
            {CRON_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => update("cron_expression", p.value)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  values.cron_expression === p.value
                    ? "bg-sienna text-white border-sienna"
                    : "bg-surface border-line text-ink-soft hover:border-sienna hover:text-sienna",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-2xs text-ink-faint mt-3 font-mono">
            min  hour  dom  month  dow
          </p>
        </div>

        <div>
          <label className="field-label">Timezone</label>
          <input
            className="input"
            value={values.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            placeholder="Asia/Kolkata"
          />
        </div>

        <label className="flex items-start gap-3 p-4 rounded-md border border-line bg-surface cursor-pointer hover:border-line-strong">
          <input
            type="checkbox"
            checked={values.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-sienna"
          />
          <div>
            <div className="text-sm font-medium text-ink">Enabled</div>
            <div className="text-xs text-ink-faint mt-0.5">
              Job will fire on schedule when enabled.
            </div>
          </div>
        </label>
      </section>

      <div className="flex items-start gap-2 px-4 py-3 rounded-md bg-amber/5 border border-amber/20 text-xs text-amber-700">
        <Info size={14} className="mt-0.5 shrink-0 text-amber" />
        <span className="text-ink-soft">
          After adding/editing a job, restart the beat container to pick up changes:
          <code className="mx-1 px-1.5 py-0.5 bg-ink/5 rounded font-mono text-2xs text-ink">
            docker compose restart beat
          </code>
        </span>
      </div>

      <div className="pt-2 flex justify-end">
        <button type="submit" disabled={saving} className="btn-accent px-6 py-2.5">
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
