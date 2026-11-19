import { daysUntil, lagosDayStartMs } from "./utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const IN_FLIGHT_MS = 15 * 60 * 1000;
export const FAILED_RETRY_MS = 3 * 60 * 60 * 1000;

export interface LogFact {
  notificationType: string;
  thresholdDays: number;
  expiryDate: Date;
  status: string;
  sentAt: Date;
}

export interface RuleSettings {
  enableExpiryNotifications: boolean;
  reminderDaysBeforeExpiry: number[];
  enableCriticalNotifications: boolean;
  criticalIntervalDays: number;
  notifyAssignedUser: boolean;
  notifyDefaultRecipients: boolean;
  defaultRecipients: string[];
}

export type Decision =
  | { kind: "reminder"; thresholdDays: number; daysRemaining: number }
  | { kind: "critical"; thresholdDays: number; daysRemaining: number };

function isActiveLog(l: LogFact, now: Date): boolean {
  const age = now.getTime() - l.sentAt.getTime();
  if (l.status === "sent") return true;
  if (l.status === "sending") return age < IN_FLIGHT_MS;
  if (l.status === "failed") return age < FAILED_RETRY_MS;
  return false;
}

export function decideNotification(
  expiryDate: Date,
  logs: LogFact[],
  cfg: Pick<
    RuleSettings,
    | "enableExpiryNotifications"
    | "reminderDaysBeforeExpiry"
    | "enableCriticalNotifications"
    | "criticalIntervalDays"
  >,
  now: Date,
): Decision | null {
  const days = daysUntil(expiryDate, now);
  if (days === null) return null;

  const cycle = logs.filter((l) => l.expiryDate.getTime() === expiryDate.getTime());

  if (days >= 0) {
    if (!cfg.enableExpiryNotifications) return null;
    const threshold = [...cfg.reminderDaysBeforeExpiry]
      .sort((a, b) => a - b)
      .find((t) => days <= t);
    if (threshold === undefined) return null;

    const handled = cycle.some(
      (l) =>
        l.notificationType === "reminder" &&
        l.thresholdDays === threshold &&
        isActiveLog(l, now),
    );
    return handled ? null : { kind: "reminder", thresholdDays: threshold, daysRemaining: days };
  }

  if (!cfg.enableCriticalNotifications) return null;
  const critical = cycle.filter((l) => l.notificationType === "critical");

  const blocked = critical.some(
    (l) =>
      (l.status === "sending" && isActiveLog(l, now)) ||
      (l.status === "failed" && isActiveLog(l, now)),
  );
  if (blocked) return null;

  const lastSent = critical
    .filter((l) => l.status === "sent")
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];

  if (lastSent) {
    const gapDays = Math.round((lagosDayStartMs(now) - lagosDayStartMs(lastSent.sentAt)) / MS_PER_DAY);
    if (gapDays < cfg.criticalIntervalDays) return null;
  }
  return { kind: "critical", thresholdDays: -days, daysRemaining: days };
}

export interface AssignedUser {
  name: string | null;
  email: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(v: string | null | undefined): v is string {
  return !!v && EMAIL_RE.test(v.trim());
}

export function getAssignedUser(v: {
  assignedDriver?: { user?: { name?: string | null; email?: string | null } | null } | null;
  statusStaffName?: string | null;
  statusStaffEmail?: string | null;
}): AssignedUser | null {
  const u = v.assignedDriver?.user;
  if (u && (u.name || u.email)) return { name: u.name ?? null, email: u.email ?? null };
  if (v.statusStaffName || v.statusStaffEmail)
    return { name: v.statusStaffName ?? null, email: v.statusStaffEmail ?? null };
  return null;
}

export function resolveRecipients(
  cfg: Pick<RuleSettings, "notifyAssignedUser" | "notifyDefaultRecipients" | "defaultRecipients">,
  assigned: AssignedUser | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined) => {
    if (!isValidEmail(raw)) return;
    const e = raw.trim().toLowerCase();
    if (!seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  };
  if (cfg.notifyAssignedUser) add(assigned?.email);
  if (cfg.notifyDefaultRecipients) cfg.defaultRecipients.forEach(add);
  return out;
}
