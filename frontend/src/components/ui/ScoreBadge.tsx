import { Chip } from "@heroui/react";

const SCORE_META = {
  5: { label: "Steal", color: "success" as const },
  4: { label: "Great", color: "success" as const },
  3: { label: "Fair", color: "default" as const },
  2: { label: "High", color: "warning" as const },
  1: { label: "Over", color: "danger" as const },
};

export function ScoreBadge({
  score,
  variant = "full",
}: {
  score: number | null;
  variant?: "full" | "compact" | "column";
}) {
  if (score === null || !(score in SCORE_META)) {
    return <span className="num text-xs text-default-400">—</span>;
  }
  const meta = SCORE_META[score as 1 | 2 | 3 | 4 | 5];

  if (variant === "compact") {
    return (
      <Chip size="sm" variant="flat" color={meta.color} className="num font-semibold">
        {score}
      </Chip>
    );
  }

  if (variant === "column") {
    const barColor = {
      success: "bg-success",
      default: "bg-default-400",
      warning: "bg-warning",
      danger: "bg-danger",
    }[meta.color];
    const textColor = {
      success: "text-success",
      default: "text-default-600",
      warning: "text-warning",
      danger: "text-danger",
    }[meta.color];
    return (
      <span className="inline-flex items-end gap-0.5 h-4" title={`${score}/5 · ${meta.label}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`w-1 rounded-sm ${i <= score ? barColor : "bg-default-200"}`}
            style={{ height: `${(i / 5) * 100}%` }}
          />
        ))}
        <span className={`ml-1.5 num text-xs font-semibold ${textColor}`}>{score}</span>
      </span>
    );
  }

  return (
    <Chip size="sm" variant="flat" color={meta.color} className="uppercase tracking-wider">
      <span className="num font-bold">{score}/5</span>
      <span className="opacity-80 ml-1">· {meta.label}</span>
    </Chip>
  );
}
