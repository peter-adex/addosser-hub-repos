import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";

const FROM = process.env.EMAIL_FROM ?? "Addosser Enterprise Hub <noreply@addosser.ng>";

export interface NotifyPayload {
  type: string;
  recipientId: string;
  title: string;
  message: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  relatedId?: string | null;
  emailParams?: {
    to: string;
    subject: string;
    html: string;
  };
}

async function isEnabled(userId: string, type: string): Promise<boolean> {
  const pref = await prisma.notificationPreference
    .findUnique({
      where: { userId_type: { userId, type } },
    })
    .catch(() => null);

  if (pref !== null && pref !== undefined) return pref.enabled;

  const meta = NOTIFICATION_TYPES.find((t) => t.key === type);
  return meta?.default ?? true;
}

function toHubType(type: string): "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "APPROVAL" | "ALERT" {
  if (type.endsWith("_approved") || type.endsWith("_reviewed") || type === "trip_completed") return "SUCCESS";
  if (type.endsWith("_rejected")) return "ERROR";
  if (type.endsWith("_submitted") || type === "appraisal_submitted") return "APPROVAL";
  if (type === "license_expiry" || type === "reminder_due" || type === "sub_expiry" || type === "login_alert") return "ALERT";
  return "INFO";
}

export async function notify(payload: NotifyPayload): Promise<void> {
  try {
    const enabled = await isEnabled(payload.recipientId, payload.type);
    if (!enabled) return;

    await prisma.notification.create({
      data: {
        userId: payload.recipientId,
        type: toHubType(payload.type),
        title: payload.title,
        message: payload.message,
        actionUrl: payload.actionUrl ?? null,
        relatedInstanceId: payload.relatedId ?? null,
        module: "fleet",
        typeKey: payload.type,
        actionLabel: payload.actionLabel ?? null,
      },
    });

    if (payload.emailParams) {
      const emailEnabled = await isEnabled(payload.recipientId, payload.type);
      if (emailEnabled) {
        const r = resend as any;
        if (r && typeof r.emails?.send === "function") {
          await r.emails
            .send({
              from: FROM,
              to: payload.emailParams.to,
              subject: payload.emailParams.subject,
              html: payload.emailParams.html,
            })
            .catch((e: any) => console.error("[notify] Email send failed:", e));
        }
      }
    }
  } catch (err) {
    console.error("[notify] Failed:", err);
  }
}

export async function notifyMany(
  recipientIds: string[],
  payload: Omit<NotifyPayload, "recipientId">,
): Promise<void> {
  await Promise.all(recipientIds.map((id) => notify({ ...payload, recipientId: id })));
}
