import { Chip } from "@heroui/react";

export function StatusPill({ status }: { status: string | null; dark?: boolean }) {
  if (!status) {
    return <span className="text-xs text-default-400">—</span>;
  }

  const normalized = status.toLowerCase();

  if (normalized === "success" || normalized === "succeeded") {
    return (
      <Chip size="sm" color="success" variant="flat">
        Success
      </Chip>
    );
  }
  if (normalized === "failed" || normalized === "error") {
    return (
      <Chip size="sm" color="danger" variant="flat">
        Failed
      </Chip>
    );
  }
  if (normalized === "running" || normalized === "started") {
    return (
      <Chip size="sm" color="warning" variant="flat">
        Running
      </Chip>
    );
  }
  if (normalized === "skipped") {
    return (
      <Chip size="sm" color="default" variant="flat" className="text-default-500">
        Skipped
      </Chip>
    );
  }
  return (
    <Chip size="sm" variant="flat">
      {status}
    </Chip>
  );
}

export function EnabledDot({ enabled }: { enabled: boolean }) {
  return (
    <Chip
      size="sm"
      variant="dot"
      color={enabled ? "success" : "default"}
      className="text-xs border-none"
    >
      {enabled ? "Live" : "Paused"}
    </Chip>
  );
}
