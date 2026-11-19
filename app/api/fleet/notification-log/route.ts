import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  errorResponse,
  requirePermission,
  getPagination,
  paginatedResponse,
} from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "fleet-settings", "canView");
  if (denied) return denied;

  const { skip, take, page, limit } = getPagination(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (type === "reminder" || type === "critical") where.notificationType = type;
  if (status === "sent" || status === "failed" || status === "sending") where.status = status;

  const [rows, total] = await prisma.$transaction([
    prisma.fleetDocumentNotificationLog.findMany({
      where,
      skip,
      take,
      orderBy: { sentAt: "desc" },
      select: {
        id: true,
        notificationType: true,
        thresholdDays: true,
        expiryDate: true,
        recipients: true,
        status: true,
        error: true,
        sentAt: true,
        vehicleDocument: {
          select: {
            type: true,
            documentType: { select: { name: true } },
            vehicle: { select: { plateNumber: true, make: true, model: true } },
          },
        },
      },
    }),
    prisma.fleetDocumentNotificationLog.count({ where }),
  ]);

  return paginatedResponse(rows, total, page, limit);
}
