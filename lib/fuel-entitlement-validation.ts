import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const APPROVED_OR_LATER_STATUSES = [
  "APPROVED",
  "PAID",
  "PARTIALLY_PAID",
  "PAYMENT_PROCESSING",
  "PAYMENT_QUEUED",
  "PAYMENT_ESCALATED",
  "OVERDUE",
] as const;

export interface FuelEntitlementCheckResult {
  hasEntitlement: boolean;
  exceeded: boolean;
  exceedanceAmount: number;
  entitlementType?: "litres" | "naira";
  entitlementAmount?: number;
  durationDays?: number;
  priorApprovedAmount?: number;
  basisMismatch?: boolean;
}

export interface FuelEntitlementLineResult extends FuelEntitlementCheckResult {
  vehicleId: string;
}

export async function checkFuelEntitlementForLines(
  lines: { vehicleId: string; fuelType: "litres" | "naira"; requestedAmount: number }[],
  opts: { asOf?: Date; tx?: Prisma.TransactionClient } = {},
): Promise<{ lines: FuelEntitlementLineResult[]; anyExceeded: boolean; totalExceedanceAmount: number }> {
  const results = await Promise.all(
    lines.map(async (l) => ({
      vehicleId: l.vehicleId,
      ...(await checkFuelEntitlement({ ...l, asOf: opts.asOf, tx: opts.tx })),
    })),
  );
  return {
    lines: results,
    anyExceeded: results.some((r) => r.exceeded),
    totalExceedanceAmount:
      Math.round(results.reduce((s, r) => s + r.exceedanceAmount, 0) * 100) / 100,
  };
}

export async function checkFuelEntitlement(params: {
  vehicleId: string;
  fuelType: "litres" | "naira";
  requestedAmount: number;
  asOf?: Date;
  tx?: Prisma.TransactionClient;
}): Promise<FuelEntitlementCheckResult> {
  const db = params.tx ?? prisma;
  const asOf = params.asOf ?? new Date();

  const entitlement = await db.vehicleFuelEntitlement.findUnique({
    where: { vehicleId: params.vehicleId },
  });

  if (!entitlement) {
    return { hasEntitlement: false, exceeded: false, exceedanceAmount: 0 };
  }

  if (entitlement.type !== params.fuelType) {
    return {
      hasEntitlement: false,
      exceeded: false,
      exceedanceAmount: 0,
      basisMismatch: true,
    };
  }

  const periodStart = new Date(asOf.getTime() - entitlement.durationDays * 86400000);

  const [priorFromLineItems, priorFromLegacyInvoice] = await Promise.all([
    db.invoiceLineItem.aggregate({
      where: {
        vehicleId: params.vehicleId,
        invoice: {
          invoiceType: "FLEET_FUEL",
          status: { in: [...APPROVED_OR_LATER_STATUSES] },
          createdAt: { gte: periodStart, lte: asOf },
        },
      },
      _sum: { quantity: true, totalCost: true },
    }),
    db.invoice.aggregate({
      where: {
        vehicleId: params.vehicleId,
        invoiceType: "FLEET_FUEL",
        fuelType: entitlement.type,
        status: { in: [...APPROVED_OR_LATER_STATUSES] },
        createdAt: { gte: periodStart, lte: asOf },
      },
      _sum: { fuelLitres: true, amountPayable: true },
    }),
  ]);

  const priorApprovedAmount =
    entitlement.type === "litres"
      ? Number(priorFromLineItems._sum.quantity ?? 0) + Number(priorFromLegacyInvoice._sum.fuelLitres ?? 0)
      : Number(priorFromLineItems._sum.totalCost ?? 0) + Number(priorFromLegacyInvoice._sum.amountPayable ?? 0);

  const projected = priorApprovedAmount + params.requestedAmount;
  const exceeded = projected > entitlement.amount;

  return {
    hasEntitlement: true,
    exceeded,
    exceedanceAmount: exceeded ? Math.round((projected - entitlement.amount) * 100) / 100 : 0,
    entitlementType: entitlement.type as "litres" | "naira",
    entitlementAmount: entitlement.amount,
    durationDays: entitlement.durationDays,
    priorApprovedAmount,
  };
}
