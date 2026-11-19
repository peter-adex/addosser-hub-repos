import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  successResponse,
  errorResponse,
  requirePermission,
} from "@/lib/api-helpers";

export async function GET(_request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);
  const denied = requirePermission(session, "dashboard", "canView");
  if (denied) return denied;

  try {
    const [
      totalVehicles,
      activeVehicles,
      inMaintenance,
      availableVehicles,
      totalDrivers,
      activeDrivers,
      ongoingTrips,
      openWorkOrders,
      pendingApproval,
      overdueReminders,
      totalFuelSpend,
      activeVendors,
      totalEntities,
      pendingAppraisals,
      unreadNotifications,
    ] = await prisma.$transaction([
      prisma.vehicle.count(),
      prisma.vehicle.count({ where: { status: "active" } }),
      prisma.vehicle.count({ where: { status: "maintenance" } }),
      prisma.vehicle.count({
        where: { allocationStatus: "available", NOT: { status: "retired" } },
      }),
      prisma.driver.count(),
      prisma.driver.count({ where: { status: "active" } }),
      prisma.trip.count({ where: { status: "ongoing" } }),

      prisma.fleetWorkOrder.count({
        where: {
          status: { in: ["PENDING_APPROVAL", "APPROVED", "IN_PROGRESS"] },
        },
      }),
      prisma.fleetWorkOrder.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.reminder.count({ where: { status: "overdue" } }),
      prisma.fuelLog.aggregate({ _sum: { totalCost: true } }),
      prisma.vendor.count({ where: { isActive: true } }),

      prisma.entity.count({ where: { status: "active" } }),
      prisma.driverAppraisal.count({ where: { status: "submitted" } }),

      prisma.notification.count({
        where: {
          userId: session.user.id,
          isRead: false,
        },
      }),
    ]);

    return successResponse({
      totalVehicles,
      activeVehicles,
      inMaintenance,
      availableVehicles,
      totalDrivers,
      activeDrivers,
      tripsToday: ongoingTrips,
      openWorkOrders,
      pendingApproval,
      overdueReminders,
      totalFuelSpend: totalFuelSpend._sum.totalCost ?? 0,
      activeVendors,
      totalEntities,
      pendingAppraisals,
      unreadNotifications,
    });
  } catch (err) {
    console.error("[GET /api/dashboard]", err);
    return errorResponse("Failed to fetch dashboard statistics", 500);
  }
}
