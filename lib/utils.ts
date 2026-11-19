import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNGN(value: number): string {
<<<<<<< HEAD
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(2)}B`;

  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(2)}M`;

=======
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(0)}K`;
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  return formatNGN(value);
}

export function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

<<<<<<< HEAD
export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
=======
export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

export function monthName(m: number): string {
  return MONTHS[m - 1] ?? "";
}
<<<<<<< HEAD

export function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const BUSINESS_TIMEZONE = "Africa/Lagos";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function lagosDayStartMs(instant: Date = new Date()): number {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysUntil(
  expiryDate: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!expiryDate) return null;
  const expiry = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  if (isNaN(expiry.getTime())) return null;

  const expiryDay = Date.UTC(
    expiry.getUTCFullYear(),
    expiry.getUTCMonth(),
    expiry.getUTCDate(),
  );
  return Math.round((expiryDay - lagosDayStartMs(now)) / MS_PER_DAY);
}

export function formatCountdown(expiryDate: string | Date | null | undefined): string {
  const days = daysUntil(expiryDate);
  if (days === null) return "—";
  if (days < 0) return "Due date is passed";
  if (days === 0) return "Due today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}

export type ExpiryStatus = "none" | "expired" | "due-today" | "upcoming";

export function expiryStatus(expiryDate: string | Date | null | undefined): ExpiryStatus {
  const days = daysUntil(expiryDate);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days === 0) return "due-today";
  return "upcoming";
}
=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
