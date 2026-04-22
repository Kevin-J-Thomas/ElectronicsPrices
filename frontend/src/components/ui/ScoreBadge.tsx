import { cn } from "@/lib/utils";

const SCORE_META = {
  5: { label: "Steal", textClass: "text-sage", bgClass: "bg-sage/10 ring-sage/25" },
  4: { label: "Great", textClass: "text-sage", bgClass: "bg-sage/8 ring-sage/20" },
  3: { label: "Fair",  textClass: "text-ink-soft", bgClass: "bg-ink/5 ring-line-strong/40" },
  2: { label: "High",  textClass: "text-amber", bgClass: "bg-amber/10 ring-amber/25" },
  1: { label: "Over",  textClass: "text-crimson", bgClass: "bg-crimson/10 ring-crimson/25" },
} as const;

/**
 * Score badge — expressive 1–5 rating.
 * Compact: small inline ("4/5" with color dot)
 * Full: pill with label ("4/5 Great")
 */
export function ScoreBadge({
  score,
  variant = "full",
}: {
  score: number | null;
  variant?: "full" | "compact" | "column";
}) {
  if (score === null || !(score in SCORE_META)) {
    return <span className="num text-xs text-ink-faint">—</span>;
  }
  const meta = SCORE_META[score as 1 | 2 | 3 | 4 | 5];

  if (variant === "compact") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 num text-xs font-semibold", meta.textClass)}>
        <span className={cn("w-1 h-3 rounded-full", meta.textClass.replace("text-", "bg-"))} />
        {score}
      </span>
    );
  }

  if (variant === "column") {
    // Vertical bar chart showing 5 bars with current filled
    return (
      <span className="inline-flex items-end gap-0.5 h-4" title={`${score}/5 · ${meta.label}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={cn(
              "w-1 rounded-sm",
              i <= score ? meta.textClass.replace("text-", "bg-") : "bg-line",
            )}
            style={{ height: `${(i / 5) * 100}%` }}
          />
        ))}
        <span className={cn("ml-1.5 num text-xs font-semibold", meta.textClass)}>{score}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium ring-1 uppercase tracking-wider",
        meta.bgClass,
        meta.textClass,
      )}
    >
      <span className="num font-bold">{score}/5</span>
      <span className="opacity-80">· {meta.label}</span>
    </span>
  );
}
