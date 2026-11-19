import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  requireRole,
  successResponse,
  errorResponse,
  requirePermission,
} from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "drivers", "canView");
  if (denied) return denied;

  const driver = await prisma.driver.findUnique({
    where: { id: params.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
        },
      },
      entity: { select: { id: true, name: true, code: true } },
      licenses: { orderBy: { isPrimary: "desc" } },
      appraisals: {
        take: 5,
        orderBy: { periodYear: "desc" },
        select: {
          id: true,
          period: true,
          overallScore: true,
          grade: true,
          status: true,
        },
      },
      trips: {
        take: 5,
        orderBy: { startTime: "desc" },
        select: { id: true, startTime: true, status: true, distanceKm: true },
      },
    },
  });

  if (!driver) return errorResponse("Driver not found", 404);
  return successResponse(driver);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "drivers", "canEdit");
  if (denied) return denied;

  const driver = await prisma.driver.findUnique({
    where: { id: params.id },
    include: { user: true },
  });
  if (!driver) return errorResponse("Driver not found", 404);

  const body = await request.json().catch(() => ({}));
  const {
    name,
    phone,
    photoUrl,
    photoPublicId,
    photoStorageProvider,
    photoStorageKey,
    supervisorId,
    status,
    assignedVehicleId,
  } = body;

  await prisma.$transaction(async (tx) => {
    if (name || phone) {
      await tx.user.update({
        where: { id: driver.userId },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(phone ? { phone: phone.trim() } : {}),
        },
      });
    }

    await tx.driver.update({
      where: { id: params.id },
      data: {
        ...(photoUrl ? { photoUrl } : {}),
        ...(photoPublicId ? { photoPublicId } : {}),
        ...(photoStorageProvider ? { photoStorageProvider } : {}),
        ...(photoStorageKey ? { photoStorageKey } : {}),
        ...(supervisorId ? { supervisorId } : {}),
        ...(status ? { status } : {}),
        ...(assignedVehicleId !== undefined ? { assignedVehicleId } : {}),
      },
    });

    if (assignedVehicleId !== undefined) {
      if (
        driver.assignedVehicleId &&
        driver.assignedVehicleId !== assignedVehicleId
      ) {
        await tx.vehicle.update({
          where: { id: driver.assignedVehicleId },
          data: { assignedDriverId: null, allocationStatus: "available" },
        });
      }
      if (assignedVehicleId) {
        await tx.vehicle.update({
          where: { id: assignedVehicleId },
          data: {
            assignedDriverId: params.id,
            allocationStatus: "allocated_driver",
          },
        });
      }
    }
  });

  const updated = await prisma.driver.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      licenses: true,
    },
  });

  return successResponse(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "drivers", "canDelete");
  if (denied) return denied;

  const driver = await prisma.driver.findUnique({ where: { id: params.id } });
  if (!driver) return errorResponse("Driver not found", 404);

  await prisma.driver.update({
    where: { id: params.id },
    data: { status: "inactive" },
  });

  if (driver.assignedVehicleId) {
    await prisma.vehicle.update({
      where: { id: driver.assignedVehicleId },
      data: {
        assignedDriverId: null,
        allocationStatus: "available",
      },
    });
  }

  return successResponse({ message: "Driver deactivated successfully" });
}
