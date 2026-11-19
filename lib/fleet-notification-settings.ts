import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const SETTINGS_ID = "singleton";

export const ALLOWED_REMINDER_DAYS = [20, 15, 10, 5] as const;
export const ALLOWED_CRITICAL_INTERVALS = [2, 3, 5, 7] as const;

export interface FleetNotificationConfig {
  enableExpiryNotifications: boolean;
  reminderDaysBeforeExpiry: number[];
  notifyAssignedUser: boolean;
  notifyDefaultRecipients: boolean;
  defaultRecipients: string[];
  enableCriticalNotifications: boolean;
  criticalIntervalDays: number;
  updatedAt: Date;
  updatedById: string | null;
}

export function normalizeEmails(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const e = raw.trim().toLowerCase();
    if (e && !seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  }
  return out;
}

function asNumberArray(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((n): n is number => typeof n === "number") : [];
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

export async function getFleetNotificationSettings(): Promise<FleetNotificationConfig> {
  const row = await prisma.fleetNotificationSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      enableExpiryNotifications: false,
      reminderDaysBeforeExpiry: [],
      notifyAssignedUser: true,
      notifyDefaultRecipients: true,
      defaultRecipients: [],
      enableCriticalNotifications: false,
      criticalIntervalDays: 3,
    },
  });

  return {
    enableExpiryNotifications: row.enableExpiryNotifications,
    reminderDaysBeforeExpiry: asNumberArray(row.reminderDaysBeforeExpiry).sort((a, b) => b - a),
    notifyAssignedUser: row.notifyAssignedUser,
    notifyDefaultRecipients: row.notifyDefaultRecipients,
    defaultRecipients: asStringArray(row.defaultRecipients),
    enableCriticalNotifications: row.enableCriticalNotifications,
    criticalIntervalDays: row.criticalIntervalDays,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  };
}

export const updateFleetNotificationSettingsSchema = z
  .object({
    enableExpiryNotifications: z.boolean(),
    reminderDaysBeforeExpiry: z
      .array(z.number().int())
      .refine((a) => a.every((n) => (ALLOWED_REMINDER_DAYS as readonly number[]).includes(n)), {
        message: `Reminder days must be from: ${ALLOWED_REMINDER_DAYS.join(", ")}`,
      }),
    notifyAssignedUser: z.boolean(),
    notifyDefaultRecipients: z.boolean(),
    defaultRecipients: z
      .array(z.string().trim().toLowerCase().email("Enter a valid email address"))
      .max(50, "A maximum of 50 default recipients is allowed"),
    enableCriticalNotifications: z.boolean(),
    criticalIntervalDays: z
      .number()
      .int()
      .refine((n) => (ALLOWED_CRITICAL_INTERVALS as readonly number[]).includes(n), {
        message: `Critical interval must be one of: ${ALLOWED_CRITICAL_INTERVALS.join(", ")} days`,
      }),
  })
  .superRefine((v, ctx) => {
    if (v.enableExpiryNotifications && v.reminderDaysBeforeExpiry.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reminderDaysBeforeExpiry"],
        message: "Select at least one reminder interval while expiry notifications are enabled",
      });
    }
    const hasRecipientRoute =
      v.notifyAssignedUser || (v.notifyDefaultRecipients && v.defaultRecipients.length > 0);
    if ((v.enableExpiryNotifications || v.enableCriticalNotifications) && !hasRecipientRoute) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultRecipients"],
        message:
          "Enable assigned-user notifications, or enable default recipients and add at least one address",
      });
    }
  });

export type UpdateFleetNotificationSettingsInput = z.infer<
  typeof updateFleetNotificationSettingsSchema
>;
