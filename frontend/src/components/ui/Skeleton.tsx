import { Skeleton as HeroSkeleton, Card, CardBody } from "@heroui/react";

export function Skeleton({ className }: { className?: string; dark?: boolean }) {
  return (
    <HeroSkeleton className={`rounded ${className ?? ""}`}>
      <div className="h-full w-full" />
    </HeroSkeleton>
  );
}

export function StatSkeleton() {
  return (
    <Card shadow="none">
      <CardBody className="gap-3">
        <HeroSkeleton className="h-3 w-24 rounded" />
        <HeroSkeleton className="h-8 w-20 rounded" />
      </CardBody>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card shadow="sm">
      <CardBody>
        <div className="flex items-end justify-between mb-6">
          <div className="space-y-2">
            <HeroSkeleton className="h-3 w-32 rounded" />
            <HeroSkeleton className="h-6 w-56 rounded" />
          </div>
          <HeroSkeleton className="h-8 w-24 rounded" />
        </div>
        <div className="h-[340px] flex items-end gap-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <HeroSkeleton
              key={i}
              className="flex-1 rounded"
              style={{ height: `${40 + ((i * 7) % 55)}%` }}
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Card shadow="sm">
      <CardBody className="p-0">
        <div className="border-b border-divider px-4 py-3 bg-default-50 flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <HeroSkeleton key={i} className="h-3 flex-1 rounded" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-b border-divider last:border-0 px-4 py-4 flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <HeroSkeleton key={j} className="h-4 flex-1 rounded" />
            ))}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
