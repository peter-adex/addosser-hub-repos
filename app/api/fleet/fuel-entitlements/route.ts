import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, errorResponse, requirePermission, successResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "fleet-settings", "canView");
  if (denied) return denied;

  const url = new URL(request.url);
  const entityId = url.searchParams.get("entityId");
  const search = url.searchParams.get("search")?.trim();

  const vehicles = await prisma.vehicle.findMany({
    where: {
      ...(entityId ? { entityId } : {}),
      ...(search
        ? {
            OR: [
              { plateNumber: { contains: search } },
              { make: { contains: search } },
              { model: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { plateNumber: "asc" },
    select: {
      id: true,
      plateNumber: true,
      make: true,
      model: true,
      entity: { select: { id: true, name: true } },
      fuelEntitlement: {
        select: { type: true, amount: true, durationDays: true, updatedAt: true },
      },
    },
  });

  return successResponse({ items: vehicles });
}
