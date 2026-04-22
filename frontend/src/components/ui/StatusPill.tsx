import { cn } from "@/lib/utils";

export function StatusPill({ status, dark = false }: { status: string | null; dark?: boolean }) {
  if (!status) {
    return <span className={cn("text-xs", dark ? "text-console-faint" : "text-ink-faint")}>—</span>;
  }

  const normalized = status.toLowerCase();

  if (normalized === "success" || normalized === "succeeded") {
    return (
      <span className="pill-success">
        <span className="w-1.5 h-1.5 rounded-full bg-sage" />
        Success
      </span>
    );
  }
  if (normalized === "failed" || normalized === "error") {
    return (
      <span className="pill-failed">
        <span className="w-1.5 h-1.5 rounded-full bg-crimson" />
        Failed
      </span>
    );
  }
  if (normalized === "running" || normalized === "started") {
    return (
      <span className="pill-running">
        <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse-dot" />
        Running
      </span>
    );
  }
  return <span className="pill-neutral">{status}</span>;
}

export function EnabledDot({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs",
        enabled ? "text-sage" : "text-ink-faint",
      )}
    >
      <span
        className={cn(
          "relative inline-block w-1.5 h-1.5 rounded-full",
          enabled ? "bg-sage" : "bg-ink-faint/60",
        )}
      >
        {enabled && (
          <span className="absolute inset-0 rounded-full bg-sage opacity-40 animate-pulse-dot" />
        )}
      </span>
      {enabled ? "Live" : "Paused"}
    </span>
  );
}
