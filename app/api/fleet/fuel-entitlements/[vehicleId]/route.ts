import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  errorResponse,
  successResponse,
  parseBody,
  requirePermission,
} from "@/lib/api-helpers";
import { logFleetAudit as logAudit } from "@/lib/audit";

const putSchema = z.object({
  type: z.enum(["litres", "naira"], {
    errorMap: () => ({ message: "Select Litres or Naira" }),
  }),
  amount: z.number().positive("Enter an amount greater than zero"),
  durationDays: z.number().int().positive("Enter a duration in days"),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { vehicleId: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "fleet-settings", "canEdit");
  if (denied) return denied;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.vehicleId },
    select: { id: true, plateNumber: true },
  });
  if (!vehicle) return errorResponse("Vehicle not found", 404);

  const { data, error } = await parseBody(request, putSchema);
  if (error) return error;

  const saved = await prisma.vehicleFuelEntitlement.upsert({
    where: { vehicleId: vehicle.id },
    update: {
      type: data.type,
      amount: data.amount,
      durationDays: data.durationDays,
      updatedById: session.user.id,
    },
    create: {
      vehicleId: vehicle.id,
      type: data.type,
      amount: data.amount,
      durationDays: data.durationDays,
      updatedById: session.user.id,
    },
  });

  logAudit(request, {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    userRole: session.user.role,
    action: "UPDATE",
    resource: "VehicleFuelEntitlement",
    resourceId: saved.id,
    details: {
      plateNumber: vehicle.plateNumber,
      type: data.type,
      amount: data.amount,
      durationDays: data.durationDays,
    },
  });

  return successResponse(saved);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { vehicleId: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "fleet-settings", "canEdit");
  if (denied) return denied;

  const existing = await prisma.vehicleFuelEntitlement.findUnique({
    where: { vehicleId: params.vehicleId },
    include: { vehicle: { select: { plateNumber: true } } },
  });
  if (!existing) return successResponse({ cleared: true });

  await prisma.vehicleFuelEntitlement.delete({ where: { vehicleId: params.vehicleId } });

  logAudit(request, {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    userRole: session.user.role,
    action: "DELETE",
    resource: "VehicleFuelEntitlement",
    resourceId: existing.id,
    details: { plateNumber: existing.vehicle.plateNumber },
  });

  return successResponse({ cleared: true });
}
