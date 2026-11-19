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

const createSchema = z.object({
  name: z.string().trim().min(2, "Document type name is required").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "vehicle-document-types", "canView");
  if (denied) return denied;

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  const search = url.searchParams.get("search") ?? "";

  const where: Record<string, any> = {};
  if (!includeInactive) where.isActive = true;
  if (search) where.name = { contains: search };

  const items = await prisma.vehicleDocumentType.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { documents: true } } },
  });

  return successResponse({ items });
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "vehicle-document-types", "canCreate");
  if (denied) return denied;

  const { data, error } = await parseBody(request, createSchema);
  if (error) return error;

  const existing = await prisma.vehicleDocumentType.findUnique({
    where: { name: data.name },
  });
  if (existing) {
    return errorResponse(`A document type named "${data.name}" already exists`, 409);
  }

  const maxSort = await prisma.vehicleDocumentType.aggregate({ _max: { sortOrder: true } });

  const type = await prisma.vehicleDocumentType.create({
    data: {
      name: data.name,
      description: data.description || undefined,
      sortOrder: data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 10,
    },
  });

  logAudit(request, {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    userRole: session.user.role,
    action: "CREATE",
    resource: "VehicleDocumentType",
    resourceId: type.id,
    details: { name: type.name },
  });

  return successResponse(type, 201);
}
