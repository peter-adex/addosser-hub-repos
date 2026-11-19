import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  successResponse,
  errorResponse,
  parseBody,
  requirePermission,
} from "@/lib/api-helpers";
import { logFleetAudit as logAudit } from "@/lib/audit";
import {
  SETTINGS_ID,
  getFleetNotificationSettings,
  normalizeEmails,
  updateFleetNotificationSettingsSchema,
} from "@/lib/fleet-notification-settings";

export async function GET() {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "fleet-settings", "canView");
  if (denied) return denied;

  const settings = await getFleetNotificationSettings();
  return successResponse(settings);
}

export async function PUT(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "fleet-settings", "canEdit");
  if (denied) return denied;

  const { data, error } = await parseBody(request, updateFleetNotificationSettingsSchema);
  if (error) return error;

  const before = await getFleetNotificationSettings();

  const next = {
    enableExpiryNotifications: data.enableExpiryNotifications,
    reminderDaysBeforeExpiry: Array.from(new Set(data.reminderDaysBeforeExpiry)).sort(
      (a, b) => b - a,
    ),
    notifyAssignedUser: data.notifyAssignedUser,
    notifyDefaultRecipients: data.notifyDefaultRecipients,
    defaultRecipients: normalizeEmails(data.defaultRecipients),
    enableCriticalNotifications: data.enableCriticalNotifications,
    criticalIntervalDays: data.criticalIntervalDays,
    updatedById: session.user.id,
  };

  const saved = await prisma.fleetNotificationSettings.upsert({
    where: { id: SETTINGS_ID },
    update: next,
    create: { id: SETTINGS_ID, ...next },
  });

  logAudit(request, {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    userRole: session.user.role,
    action: "UPDATE",
    resource: "FleetNotificationSettings",
    resourceId: saved.id,
    details: {
      before: {
        enableExpiryNotifications: before.enableExpiryNotifications,
        reminderDaysBeforeExpiry: before.reminderDaysBeforeExpiry,
        defaultRecipients: before.defaultRecipients,
        enableCriticalNotifications: before.enableCriticalNotifications,
        criticalIntervalDays: before.criticalIntervalDays,
      },
      after: next,
    },
  });

  return successResponse(await getFleetNotificationSettings());
}
