import { prisma } from "./prisma";
import { NotificationType as PrismaNotificationType } from "@prisma/client";

type NotificationType =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "APPROVAL"
  | "APPROVAL_REQUIRED"
  | "ALERT"
  | "ASSET_MOVED"
  | "PAYMENT";

interface CreateNotificationOptions {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  actionUrl?: string;
  meta?: Record<string, unknown>;
  relatedInstanceId?: string;
}

export async function notify(
  opts: CreateNotificationOptions,
): Promise<{ id: string } | null> {
  try {
    const rawTypeString = String(opts.type ?? "INFO").replace(
      "APPROVAL_REQUIRED",
      "APPROVAL",
    );

    const finalEnumStatus = [
      "INFO",
      "SUCCESS",
      "WARNING",
      "ERROR",
      "APPROVAL",
      "ALERT",
      "ASSET_MOVED",
      "PAYMENT",
    ].includes(rawTypeString)
      ? (rawTypeString as PrismaNotificationType)
      : ("INFO" as PrismaNotificationType);

    const n = await prisma.notification.create({
      data: {
        userId: opts.userId,
        title: opts.title,
        message: opts.message,
        type: finalEnumStatus,
        actionUrl: opts.actionUrl ?? null,
        relatedInstanceId: opts.relatedInstanceId ?? null,
      },
    });
    return n;
  } catch (err) {
    console.error("[notify] Failed to create notification:", err);
    return null;
  }
}

export async function notifyBudgetDecision(opts: {
  userId: string;
  action: "APPROVED" | "REJECTED";
  glName: string;
  entity: string;
  budgetId: string;
  comment?: string;
}) {
  const approved = opts.action === "APPROVED";
  await notify({
    userId: opts.userId,
    title: `Budget ${approved ? "Approved ✅" : "Rejected ❌"}`,
    message: `Your ${opts.entity} budget for "${opts.glName}" has been ${approved ? "approved" : "rejected"}.${opts.comment ? `\n\nReviewer note: ${opts.comment}` : ""}`,
    type: approved ? "SUCCESS" : "WARNING",
    actionUrl: `/budgeting/${opts.budgetId}`,
    meta: { budgetId: opts.budgetId, action: opts.action },
  });
}

export async function notifyBudgetSubmitted(opts: {
  approverIds: string[];
  submitterName: string;
  glName: string;
  entity: string;
  budgetId: string;
}) {
  await Promise.all(
    opts.approverIds.map((userId) =>
      notify({
        userId,
        title: "Budget Awaiting Approval",
        message: `${opts.submitterName} submitted a ${opts.entity} budget for "${opts.glName}" and it requires your approval.`,
        type: "APPROVAL",
        actionUrl: `/budgeting/${opts.budgetId}`,
        meta: { budgetId: opts.budgetId },
      }),
    ),
  );
}

export async function notifyUserInvited(opts: {
  adminId: string;
  email: string;
}) {
  await notify({
    userId: opts.adminId,
    title: "Invitation Sent",
    message: `An invitation has been sent to ${opts.email}. They have 7 days to accept.`,
    type: "SUCCESS",
    actionUrl: "/admin",
  });
}

export const createNotification = notify;
