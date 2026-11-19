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

  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  const denied = requirePermission(session, "vendors", "canView");

  if (denied) {
    return denied;
  }

  const vendor = await prisma.vendor.findUnique({
    where: {
      id: params.id,
    },

    include: {
      contacts: true,

      fleetWorkOrders: {
        take: 5,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          workOrderNumber: true,
          status: true,
        },
      },

      maintenanceRecords: {
        take: 5,
        orderBy: {
          date: "desc",
        },
        select: {
          id: true,
          type: true,
          date: true,
          costNgn: true,
        },
      },
    },
  });

  if (!vendor) {
    return errorResponse("Vendor not found", 404);
  }

  return successResponse(vendor);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);
  const denied = requirePermission(session, "vendors", "canEdit");
  if (denied) return denied;

  const vendor = await prisma.vendor.findUnique({ where: { id: params.id } });
  if (!vendor) return errorResponse("Vendor not found", 404);

  const body = await request.json().catch(() => ({}));
  const { contacts, classifications, ...rest } = body;

  const updated = await prisma.vendor.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(classifications
        ? { classifications: JSON.stringify(classifications) }
        : {}),
    },
    include: { contacts: true },
  });

  return successResponse(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);
  const denied = requirePermission(session, "vendors", "canDelete");
  if (denied) return denied;

  const woCount = await prisma.fleetWorkOrder.count({
    where: { vendorId: params.id },
  });
  if (woCount > 0) {
    await prisma.vendor.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return successResponse({
      message: `Vendor deactivated (has ${woCount} work order records)`,
    });
  }

  await prisma.vendor.delete({ where: { id: params.id } });
  return successResponse({ message: "Vendor deleted" });
}
