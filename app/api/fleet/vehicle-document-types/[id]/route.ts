import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  successResponse,
  errorResponse,
  parseBody,
  requirePermission,
} from "@/lib/api-helpers";
import { logFleetAudit as logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "vehicle-document-types", "canView");
  if (denied) return denied;

  const type = await prisma.vehicleDocumentType.findUnique({
    where: { id: params.id },
    include: { _count: { select: { documents: true } } },
  });
  if (!type) return errorResponse("Document type not found", 404);
  return successResponse(type);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "vehicle-document-types", "canEdit");
  if (denied) return denied;

  const { data, error } = await parseBody(request, updateSchema);
  if (error) return error;

  const before = await prisma.vehicleDocumentType.findUnique({ where: { id: params.id } });
  if (!before) return errorResponse("Document type not found", 404);

  if (data.name && data.name !== before.name) {
    const clash = await prisma.vehicleDocumentType.findFirst({
      where: { name: data.name, NOT: { id: params.id } },
    });
    if (clash) {
      return errorResponse(`A document type named "${data.name}" already exists`, 409);
    }
  }

  const updated = await prisma.vehicleDocumentType.update({
    where: { id: params.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  logAudit(request, {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    userRole: session.user.role,
    action: data.isActive !== undefined ? (data.isActive ? "ENABLE" : "DISABLE") : "UPDATE",
    resource: "VehicleDocumentType",
    resourceId: params.id,
    details: { before: { name: before.name, isActive: before.isActive }, after: { name: updated.name, isActive: updated.isActive } },
  });

  return successResponse(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "vehicle-document-types", "canDelete");
  if (denied) return denied;

  const type = await prisma.vehicleDocumentType.findUnique({ where: { id: params.id } });
  if (!type) return errorResponse("Document type not found", 404);

  const referenceCount = await prisma.vehicleDocument.count({ where: { documentTypeId: params.id } });

  if (referenceCount > 0) {
    await prisma.vehicleDocumentType.update({ where: { id: params.id }, data: { isActive: false } });
    logAudit(request, {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      userRole: session.user.role,
      action: "DISABLE",
      resource: "VehicleDocumentType",
      resourceId: params.id,
      details: { name: type.name, reason: "referenced by existing vehicle documents — soft-disabled instead of deleted" },
    });
    return successResponse({
      message: `"${type.name}" is used by ${referenceCount} existing document record(s) — deactivated instead of deleted.`,
      softDeleted: true,
    });
  }

  await prisma.vehicleDocumentType.delete({ where: { id: params.id } });
  logAudit(request, {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    userRole: session.user.role,
    action: "DELETE",
    resource: "VehicleDocumentType",
    resourceId: params.id,
    details: { name: type.name },
  });
  return successResponse({ message: `"${type.name}" deleted`, softDeleted: false });
}
