import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  successResponse,
  errorResponse,
} from "@/lib/api-helpers";

export async function GET(_request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const entities = await prisma.entity.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      annualMaintenanceBudgetNgn: true,
    },
  });

  const entityStats = await Promise.all(
    entities.map(async (entity) => {
      const [
        totalVehicles,
        activeVehicles,
        vehiclesInMaintenance,
        totalDrivers,
        activeDrivers,
        ongoingTrips,
        pendingApprovals,

        fuelThisMonth,
        fuelYTD,

        woThisMonth,
        woYTD,
      ] = await Promise.all([
        prisma.vehicle.count({ where: { entityId: entity.id } }),
        prisma.vehicle.count({
          where: { entityId: entity.id, status: "active" },
        }),
        prisma.vehicle.count({
          where: { entityId: entity.id, status: "maintenance" },
        }),

        prisma.driver.count({ where: { entityId: entity.id } }),
        prisma.driver.count({
          where: { entityId: entity.id, status: "active" },
        }),

        prisma.trip.count({
          where: {
            status: "ongoing",
            vehicle: { entityId: entity.id },
          },
        }),

        prisma.fleetWorkOrder.count({
          where: {
            status: "PENDING_APPROVAL",
            vehicle: { entityId: entity.id },
          },
        }),

        prisma.fuelLog.aggregate({
          where: {
            entityId: entity.id,
            date: { gte: monthStart },
          },
          _sum: { totalCost: true },
        }),

        prisma.fuelLog.aggregate({
          where: {
            entityId: entity.id,
            date: { gte: yearStart },
          },
          _sum: { totalCost: true },
        }),

        prisma.fleetWorkOrder.aggregate({
          where: {
            vehicle: { entityId: entity.id },
            status: { in: ["COMPLETED", "IN_PROGRESS", "APPROVED"] },
            createdAt: { gte: monthStart },
          },
          _sum: { totalPlusVat: true },
        }),

        prisma.fleetWorkOrder.aggregate({
          where: {
            vehicle: { entityId: entity.id },
            status: { in: ["COMPLETED", "IN_PROGRESS", "APPROVED"] },
            createdAt: { gte: yearStart },
          },
          _sum: { totalPlusVat: true },
        }),
      ]);

      const fuelSpendMonth = fuelThisMonth._sum.totalCost ?? 0;
      const fuelSpendYTD = fuelYTD._sum.totalCost ?? 0;

      const maintenanceCostMonth = woThisMonth._sum.totalPlusVat ?? 0;
      const maintenanceCostYTD = woYTD._sum.totalPlusVat ?? 0;

      const budgetUsed = maintenanceCostYTD + fuelSpendYTD;
      const budgetTotal = entity.annualMaintenanceBudgetNgn ?? 0;
      const budgetPct =
        budgetTotal > 0 ? Math.min(100, (budgetUsed / budgetTotal) * 100) : 0;

      return {
        id: entity.id,
        name: entity.name,
        code: entity.code,
        annualBudget: budgetTotal,
        totalVehicles,
        activeVehicles,
        vehiclesInMaintenance,
        totalDrivers,
        activeDrivers,
        ongoingTrips,
        pendingApprovals,
        fuelSpendMonth,
        fuelSpendYTD,
        maintenanceCostMonth,
        maintenanceCostYTD,
        budgetUsed,
        budgetPct: Math.round(budgetPct * 10) / 10,
      };
    }),
  );

  const grand = {
    totalVehicles: entityStats.reduce((s, e) => s + e.totalVehicles, 0),
    activeVehicles: entityStats.reduce((s, e) => s + e.activeVehicles, 0),
    totalDrivers: entityStats.reduce((s, e) => s + e.totalDrivers, 0),
    ongoingTrips: entityStats.reduce((s, e) => s + e.ongoingTrips, 0),
    pendingApprovals: entityStats.reduce((s, e) => s + e.pendingApprovals, 0),
    fuelSpendMonth: entityStats.reduce((s, e) => s + e.fuelSpendMonth, 0),
    fuelSpendYTD: entityStats.reduce((s, e) => s + e.fuelSpendYTD, 0),
    maintenanceCostMonth: entityStats.reduce(
      (s, e) => s + e.maintenanceCostMonth,
      0,
    ),
    maintenanceCostYTD: entityStats.reduce(
      (s, e) => s + e.maintenanceCostYTD,
      0,
    ),
  };

  return successResponse({ entities: entityStats, grand });
}
