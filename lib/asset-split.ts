import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface ChildSpec {
  serialNo?: string;
  barcodeTag?: string;
  assignedToId?: string;
  branchId?: string;
  location?: string;
}

export interface SplitPreview {
  eligible: boolean;
  reason?: string;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number;
  totalCostBefore: number;
  totalCostAfter: number;
  bookValueBefore: number;
  accumulatedDeprBefore: number;
  perUnitBookValue: number;
  perUnitAccumulatedDepr: number;
  perUnitResidualValue: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function allocateExact(total: number, count: number): number[] {
  if (count <= 0) return [];
  const shares: number[] = [];
  let allocated = 0;
  for (let i = 0; i < count - 1; i++) {
    const share = round2(total / count);
    shares.push(share);
    allocated += share;
  }
  shares.push(round2(total - allocated));
  return shares;
}

export async function checkSplitEligibility(assetId: string): Promise<{ eligible: boolean; reason?: string; asset?: any }> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return { eligible: false, reason: "Asset not found" };
  if (asset.quantity <= 1) {
    return { eligible: false, reason: "This asset represents a single unit (quantity 1) and cannot be split further.", asset };
  }
  if (asset.status !== "ACTIVE") {
    return { eligible: false, reason: `Asset must be ACTIVE to be split (current status: ${asset.status}).`, asset };
  }
  if (asset.approvalStatus !== "APPROVED") {
    return { eligible: false, reason: "Asset must be fully approved before it can be split.", asset };
  }
  const pendingSplit = await prisma.assetSplit.findFirst({
    where: { parentAssetId: assetId, status: { in: ["DRAFT", "PENDING_APPROVAL"] } },
  });
  if (pendingSplit) {
    return { eligible: false, reason: "This asset already has a split request in progress. Complete or cancel it first.", asset };
  }
  return { eligible: true, asset };
}

export function previewSplit(asset: any, quantityToSplit: number): SplitPreview {
  const quantityBefore = asset.quantity;
  const unitCost = Number(asset.unitCost ?? asset.acquisitionValue ?? 0);
  const bookValueBefore = Number(asset.currentBookValue ?? asset.acquisitionValue ?? 0);
  const totalCostBefore = Number(asset.acquisitionValue ?? 0);
  const accumulatedDeprBefore = round2(totalCostBefore - bookValueBefore);
  const residualBefore = Number(asset.residualValue ?? 0);

  return {
    eligible: quantityToSplit >= 1 && quantityToSplit <= quantityBefore,
    quantityBefore,
    quantityAfter: quantityBefore - quantityToSplit,
    unitCost,
    totalCostBefore,
    totalCostAfter: totalCostBefore,
    bookValueBefore,
    accumulatedDeprBefore,
    perUnitBookValue: round2(bookValueBefore / quantityBefore),
    perUnitAccumulatedDepr: round2(accumulatedDeprBefore / quantityBefore),
    perUnitResidualValue: round2(residualBefore / quantityBefore),
  };
}

async function generateChildCodes(tx: Prisma.TransactionClient, parentAssetNo: string, parentId: string, count: number): Promise<string[]> {
  const existingChildren = await tx.asset.count({ where: { parentAssetId: parentId } });
  const codes: string[] = [];
  for (let i = 1; i <= count; i++) {
    codes.push(`${parentAssetNo}-${String(existingChildren + i).padStart(2, "0")}`);
  }
  return codes;
}

export async function executeSplitInTransaction(
  tx: Prisma.TransactionClient,
  split: { id: string; parentAssetId: string; quantitySplit: number },
  children: ChildSpec[],
): Promise<{ childIds: string[] }> {
  const parent = await tx.asset.findUnique({ where: { id: split.parentAssetId } });
  if (!parent) throw new Error("Parent asset not found");
  if (children.length !== split.quantitySplit) {
    throw new Error(`Expected ${split.quantitySplit} child specs, got ${children.length}`);
  }
  if (split.quantitySplit > parent.quantity) {
    throw new Error(`Cannot split ${split.quantitySplit} units — parent only has ${parent.quantity} remaining`);
  }

  const preview = previewSplit(parent, split.quantitySplit);
  const bookValueShares = allocateExact(preview.perUnitBookValue * split.quantitySplit, split.quantitySplit);
  const residualShares  = allocateExact(preview.perUnitResidualValue * split.quantitySplit, split.quantitySplit);
  const codes = await generateChildCodes(tx, parent.assetNo, parent.id, split.quantitySplit);

  const childIds: string[] = [];
  for (let i = 0; i < split.quantitySplit; i++) {
    const spec = children[i];
    const created = await tx.asset.create({
      data: {
        assetNo:           codes[i],
        serialNo:          spec.serialNo || undefined,
        barcodeTag:        spec.barcodeTag || undefined,
        name:              parent.name,
        description:       parent.description,
        classificationId:  parent.classificationId,
        legacyCategory:    parent.legacyCategory,
        make:              parent.make,
        model:             parent.model,
        entityId:          parent.entityId,
        branchId:          spec.branchId || parent.branchId,
        location:          spec.location || parent.location,
        isMovable:         parent.isMovable,
        quantity:          1,
        unitCost:          preview.unitCost,
        acquisitionValue:  preview.unitCost,
        residualValue:     residualShares[i],
        currentBookValue:  bookValueShares[i],
        purchaseDate:      parent.purchaseDate,
        usefulLifeYrs:     parent.usefulLifeYrs,
        depreciationMethod: parent.depreciationMethod,
        lastDepreciationDate: parent.lastDepreciationDate,
        condition:         parent.condition,
        status:            "ACTIVE",
        approvalStatus:    "APPROVED",
        supplier:          parent.supplier,
        invoiceRef:        parent.invoiceRef,
        warrantyExpiry:    parent.warrantyExpiry,
        insuranceExpiry:   parent.insuranceExpiry,
        glAccountCode:     parent.glAccountCode,
        budgetRef:         parent.budgetRef,
        tags:              parent.tags,
        assignedToId:      spec.assignedToId || undefined,
        createdById:       parent.createdById,
        parentAssetId:     parent.id,
        splitId:           split.id,
      },
    });
    childIds.push(created.id);
  }

  const totalBookValueAllocated = bookValueShares.reduce((a, b) => a + b, 0);
  const totalResidualAllocated  = residualShares.reduce((a, b) => a + b, 0);
  const newQuantity = parent.quantity - split.quantitySplit;

  await tx.asset.update({
    where: { id: parent.id },
    data: {
      quantity:         newQuantity,
      acquisitionValue: round2(preview.unitCost * newQuantity),
      currentBookValue: round2(preview.bookValueBefore - totalBookValueAllocated),
      residualValue:    round2(Number(parent.residualValue ?? 0) - totalResidualAllocated),
      status:           newQuantity === 0 ? "SPLIT" : parent.status,
    },
  });

  return { childIds };
}
