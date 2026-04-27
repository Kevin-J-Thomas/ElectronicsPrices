import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number, opts?: { compact?: boolean }): string {
  if (opts?.compact && amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

/**
 * Parse a backend timestamp. The API returns naive UTC ISO strings (no Z suffix)
 * because SQLAlchemy stores `datetime.utcnow()` without tzinfo. JavaScript treats
 * a naive ISO string as local time, so we explicitly append Z to read it as UTC.
 */
export function parseUTC(iso: string): Date {
  if (!iso) return new Date(NaN);
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : iso + "Z");
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const d = parseUTC(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
