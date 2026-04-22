import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded",
        dark ? "shimmer-dark" : "shimmer",
        className,
      )}
    />
  );
}

export function StatSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="card p-6">
      <div className="flex items-end justify-between mb-6">
        <div>
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-6 w-56" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="h-[340px] flex items-end gap-2">
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            // deterministic per-index height to avoid hydration mismatch
            // height varies between 40% and 95%
          />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3 bg-paper/40 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-line/60 px-4 py-4 flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
