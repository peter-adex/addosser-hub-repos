import { getPaymentCaps } from "@/lib/payment-access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGranularPermission } from "@/lib/permissions";
import { getRequiredSession, requirePermission } from "@/lib/api-helpers";

export interface AccessResult {
  allowed: boolean;
  status?: number;
  error?: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export async function checkAccess(key: string): Promise<AccessResult> {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) return { allowed: false, status: 401, error: "Unauthorized" };

  if (key.startsWith("assets/documents/")) {
    const doc = await prisma.assetDocument.findFirst({ where: { storageKey: key } });
    if (!doc) return { allowed: false, status: 404, error: "File not found" };
    const canView = user.isSystem || (await hasGranularPermission("assets", "documents", "view"));
    if (!canView) return { allowed: false, status: 403, error: "Forbidden" };
    return { allowed: true, mimeType: doc.mimeType, fileName: doc.title };
  }

  if (key.startsWith("assets/movements/")) {
    const canView = user.isSystem || (await hasGranularPermission("assets", "movement", "view"));
    if (!canView) return { allowed: false, status: 403, error: "Forbidden" };
    return { allowed: true };
  }

  if (key.startsWith("assets/")) {
    const canView = user.isSystem || (await hasGranularPermission("assets", "documents", "view"));
    if (!canView) return { allowed: false, status: 403, error: "Forbidden" };
    return { allowed: true };
  }

  if (key.startsWith("invoices/attachments/")) {
    const canView = user.isSystem || (await hasGranularPermission("invoice", "invoices", "view"));
    if (!canView) return { allowed: false, status: 403, error: "Forbidden" };
    return { allowed: true };
  }

  if (key.startsWith("vendor-contracts/")) {
    if (!user.isSystem) return { allowed: false, status: 403, error: "Forbidden" };
    return { allowed: true };
  }

  if (key.startsWith("payment/proofs/")) {
    const proof = await prisma.paymentProof.findFirst({
      where: { storageKey: key },
      include: { paymentTranche: { include: { paymentBatch: { select: { tellerId: true } } } } },
    });
    if (!proof) return { allowed: false, status: 404, error: "File not found" };
    const isTeller = proof.paymentTranche?.paymentBatch?.tellerId === user.id;
    if (!user.isSystem && !isTeller && !(await getPaymentCaps(user)).view()) {
      return { allowed: false, status: 403, error: "Forbidden" };
    }
    return { allowed: true, mimeType: proof.fileType, fileName: proof.fileName };
  }

  if (key.startsWith("fleet/")) {
    const required = await getRequiredSession();
    if (!required) return { allowed: false, status: 401, error: "Unauthorized" };

    if (key.startsWith("fleet/drivers/")) {
      const denied = requirePermission(required, "drivers", "canView");
      if (denied) return { allowed: false, status: 403, error: "Forbidden" };
      return { allowed: true };
    }
    if (key.startsWith("fleet/vehicle-docs/")) {
      const doc = await prisma.vehicleDocument.findFirst({ where: { storageKey: key } });
      const denied = requirePermission(required, "vehicles", "canView");
      if (denied) return { allowed: false, status: 403, error: "Forbidden" };
      return { allowed: true, mimeType: doc?.mimeType ?? null, fileName: doc?.name ?? null };
    }
    if (key.startsWith("fleet/vehicles/")) {
      const denied = requirePermission(required, "vehicles", "canView");
      if (denied) return { allowed: false, status: 403, error: "Forbidden" };
      return { allowed: true };
    }
    if (key.startsWith("fleet/work-orders/")) {
      const denied = requirePermission(required, "maintenance", "canView");
      if (denied) return { allowed: false, status: 403, error: "Forbidden" };
      return { allowed: true };
    }
    if (key.startsWith("fleet/appraisals/")) {
      const denied = requirePermission(required, "appraisals", "canView");
      if (denied) return { allowed: false, status: 403, error: "Forbidden" };
      return { allowed: true };
    }
    return { allowed: false, status: 404, error: "Unknown fleet file module" };
  }

  if (key.startsWith("avatars/")) {
    return { allowed: true };
  }

  return { allowed: false, status: 404, error: "Unknown storage module" };
}
