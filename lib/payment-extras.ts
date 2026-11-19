import { prisma } from "./prisma";
import { getHeadRoleIds, getTellerRoleIds, getSupervisorRoleIds } from "./payment-access";
import type { PermissionKey } from "./permissions";

export async function getUsersWithPaymentPermission(
  entityId: string,
  permission: PermissionKey
) {
  const roleIds =
    permission === "canCreate"
      ? await getHeadRoleIds()
      : permission === "canEdit"
      ? await getTellerRoleIds()
      : permission === "canApprove"
      ? await getSupervisorRoleIds()
      : [];
  if (roleIds.length === 0) return [];

  return prisma.user.findMany({
    where: {
      isActive: true,
      roleId: { in: roleIds },
      OR: [
        { entityId },
        { entityAccess: { some: { entityId } } },
      ],
    },
    select: { id: true, name: true, email: true },
  });
}

export async function notifyUsers(
  users: { id: string; email: string; name: string }[],
  payload: {
    title: string;
    message: string;
    actionUrl: string;
    type: "INFO" | "SUCCESS" | "APPROVAL" | "WARNING" | "ALERT";
  }
) {
  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      actionUrl: payload.actionUrl,
    })),
  });

  try {
    const { broadcastToUsers } = await import("./sse");
    broadcastToUsers(users.map((u) => u.id), "notification");
  } catch {
  }
}

export const paymentEscalation = () => prisma.paymentEscalation;
export const paymentJournalEntry = () => prisma.paymentJournalEntry;
