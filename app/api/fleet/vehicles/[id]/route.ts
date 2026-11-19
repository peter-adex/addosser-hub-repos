import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  requirePermission,
  successResponse,
  errorResponse,
  parseBody,
} from "@/lib/api-helpers";
import { z } from "zod";
import { logFleetAudit as logAudit } from "@/lib/audit";
import { deleteObject } from "@/lib/storage";
import { resolveDocumentType } from "@/lib/vehicle-document-types";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "vehicles", "canView");
  if (denied) return denied;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    include: {
      entity: { select: { id: true, name: true, shortName: true, code: true } },
      location: { select: { id: true, name: true, city: true } },

      images: {
        orderBy: [{ isPrimary: "desc" }, { uploadedAt: "asc" }],
      },

      documents: {
        orderBy: { uploadedAt: "desc" },
        include: {
          uploadedBy: { select: { name: true } },
          documentType: { select: { id: true, name: true, isActive: true } },
        },
      },

      assignedDriver: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          licenses: { where: { isPrimary: true }, take: 1 },
        },
      },

      purchaseVendor: { select: { id: true, name: true } },

      trips: {
        orderBy: { startTime: "desc" },
        take: 10,
        include: {
          driver: { include: { user: { select: { name: true } } } },
        },
      },

      maintenance: {
        orderBy: { date: "desc" },
        take: 5,
      },
    },
  });

  if (!vehicle) return errorResponse("Vehicle not found", 404);

  return successResponse(vehicle);
}

const updateVehicleSchema = z.object({
  status: z.enum(["active", "idle", "maintenance", "retired"]).optional(),
  mileage: z.number().min(0).optional(),
  colour: z.string().optional(),
  entityId: z.string().cuid().optional(),
  locationId: z.string().cuid().optional().nullable(),
  assignedDriverId: z.string().cuid().optional().nullable(),
  allocationStatus: z
    .enum(["available", "allocated_driver", "allocated_status"])
    .optional(),
  usefulLifeYears: z.number().int().min(1).max(30).optional(),
  acquisitionValueNgn: z.number().min(0).optional(),
  purchaseDate: z.string().optional().nullable(),
  purchaseVendorId: z.string().cuid().optional().nullable(),
  statusStaffName: z.string().optional().nullable(),
  statusStaffDept: z.string().optional().nullable(),
  statusStaffRole: z.string().optional().nullable(),
  statusStaffId: z.string().optional().nullable(),
  statusStaffPhone: z.string().optional().nullable(),
  statusStaffEmail: z.string().email().optional().nullable().or(z.literal("")),
  vehicleUse: z.enum(["pool", "status"]).optional(),
  newImages: z
    .array(
      z.object({
        url: z.string().refine((v) => v.startsWith("/") || /^https?:\/\//.test(v)),
        publicId: z.string().optional(),
        storageProvider: z.string().optional(),
        storageKey: z.string().optional(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .optional(),
  newDocuments: z
    .array(
      z.object({
        name: z.string().min(1),
        documentTypeId: z.string().min(1, "Document type is required"),
        url: z.string().optional(),
        publicId: z.string().optional(),
        storageProvider: z.string().optional(),
        storageKey: z.string().optional(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        expiryDate: z.string().optional().nullable(),
      }),
    )
    .optional(),
  deleteImageIds: z.array(z.string()).optional(),
  deleteDocumentIds: z.array(z.string()).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "vehicles", "canEdit");
  if (denied) return denied;

  const { data, error } = await parseBody(request, updateVehicleSchema);
  if (error) return error;

  const existing = await prisma.vehicle.findUnique({
    where: { id: params.id },
  });
  if (!existing) return errorResponse("Vehicle not found", 404);

  let resolvedDocTypes: { id: string; name: string }[] = [];
  if (data.newDocuments?.length) {
    const resolved = await Promise.all(
      data.newDocuments.map((d) => resolveDocumentType(d.documentTypeId)),
    );
    const badIndex = resolved.findIndex((t) => !t);
    if (badIndex !== -1) {
      return errorResponse(
        `Document ${badIndex + 1}: invalid or inactive document type`,
        400,
      );
    }
    resolvedDocTypes = resolved as { id: string; name: string }[];

    const seenInBatch = new Map<string, number>();
    for (let i = 0; i < resolvedDocTypes.length; i++) {
      const typeId = resolvedDocTypes[i].id;
      if (seenInBatch.has(typeId)) {
        return errorResponse(
          `Duplicate document type: "${resolvedDocTypes[i].name}" was selected more than once`,
          400,
        );
      }
      seenInBatch.set(typeId, i);
    }

    const conflicting = await prisma.vehicleDocument.findFirst({
      where: {
        vehicleId: params.id,
        documentTypeId: { in: resolvedDocTypes.map((t) => t.id) },
        id: { notIn: data.deleteDocumentIds ?? [] },
      },
      include: { documentType: { select: { name: true } } },
    });
    if (conflicting) {
      return errorResponse(
        `A ${conflicting.documentType?.name ?? conflicting.type} document already exists for this vehicle`,
        409,
      );
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (data.deleteImageIds?.length) {
        const toDelete = await tx.vehicleImage.findMany({
          where: { id: { in: data.deleteImageIds }, vehicleId: params.id },
          select: { storageKey: true },
        });
        await tx.vehicleImage.deleteMany({
          where: { id: { in: data.deleteImageIds }, vehicleId: params.id },
        });
        await Promise.all(
          toDelete
            .filter((img) => img.storageKey)
            .map((img) => deleteObject(img.storageKey!).catch((err) =>
              console.error("[PUT /api/fleet/vehicles/:id] failed to delete storage object", img.storageKey, err),
            )),
        );
      }

      if (data.deleteDocumentIds?.length) {
        const toDelete = await tx.vehicleDocument.findMany({
          where: { id: { in: data.deleteDocumentIds }, vehicleId: params.id },
          select: { storageKey: true },
        });
        await tx.vehicleDocument.deleteMany({
          where: { id: { in: data.deleteDocumentIds }, vehicleId: params.id },
        });
        await Promise.all(
          toDelete
            .filter((doc) => doc.storageKey)
            .map((doc) => deleteObject(doc.storageKey!).catch((err) =>
              console.error("[PUT /api/fleet/vehicles/:id] failed to delete storage object", doc.storageKey, err),
            )),
        );
      }

      if (data.newImages?.length) {
        if (data.newImages.some((img) => img.isPrimary)) {
          await tx.vehicleImage.updateMany({
            where: { vehicleId: params.id },
            data: { isPrimary: false },
          });
        }
        await tx.vehicleImage.createMany({
          data: data.newImages.map((img, i) => ({
            vehicleId: params.id,
            url: img.url,
            publicId: img.publicId ?? null,
            storageProvider: img.storageProvider ?? null,
            storageKey: img.storageKey ?? null,
            isPrimary: img.isPrimary ?? i === 0,
          })),
        });
      }

      if (data.newDocuments?.length) {
        await tx.vehicleDocument.createMany({
          data: data.newDocuments.map((doc, i) => ({
            vehicleId: params.id,
            name: doc.name,
            type: resolvedDocTypes[i].name,
            documentTypeId: resolvedDocTypes[i].id,
            url: doc.url || null,
            publicId: doc.publicId ?? null,
            storageProvider: doc.storageProvider ?? null,
            storageKey: doc.storageKey ?? null,
            fileSize: doc.fileSize ?? null,
            mimeType: doc.mimeType ?? null,
            expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null,
            uploadedById: session.user.id,
          })),
        });
      }

      if (
        data.assignedDriverId !== undefined &&
        data.assignedDriverId !== existing.assignedDriverId
      ) {
        if (existing.assignedDriverId) {
          await tx.driver
            .update({
              where: { id: existing.assignedDriverId },
              data: { assignedVehicleId: null },
            })
            .catch(() => {});
        }
        if (data.assignedDriverId) {
          await tx.driver
            .update({
              where: { id: data.assignedDriverId },
              data: { assignedVehicleId: params.id },
            })
            .catch(() => {});
        }
      }

      const {
        newImages: _ni,
        newDocuments: _nd,
        deleteImageIds: _di,
        deleteDocumentIds: _dd,
        ...vehicleFields
      } = data;

      await tx.vehicle.update({
        where: { id: params.id },
        data: {
          ...vehicleFields,
          purchaseDate: vehicleFields.purchaseDate
            ? new Date(vehicleFields.purchaseDate)
            : vehicleFields.purchaseDate === null
              ? null
              : undefined,
        },
      });
    });

    const updated = await prisma.vehicle.findUnique({
      where: { id: params.id },
      include: {
        entity: { select: { name: true, code: true } },
        assignedDriver: { include: { user: { select: { name: true } } } },
        images: { orderBy: [{ isPrimary: "desc" }, { uploadedAt: "asc" }] },
        documents: { orderBy: { uploadedAt: "desc" } },
      },
    });

    logAudit(request, {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      userRole: session.user.role,
      action: "UPDATE",
      resource: "Vehicle",
      resourceId: params.id,
      details: { plateNumber: existing.plateNumber },
    });

    return successResponse(updated);
  } catch (err) {
    console.error("[PUT /api/vehicles/[id]]", err);
    return errorResponse("Failed to update vehicle", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "vehicles", "canDelete");
  if (denied) return denied;

  const vehicle = await prisma.vehicle.findUnique({ where: { id: params.id } });
  if (!vehicle) return errorResponse("Vehicle not found", 404);

  if (vehicle.assignedDriverId) {
    await prisma.driver
      .update({
        where: { id: vehicle.assignedDriverId },
        data: { assignedVehicleId: null },
      })
      .catch(() => {});
  }

  await prisma.vehicle.delete({ where: { id: params.id } });

  logAudit(request, {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    userRole: session.user.role,
    action: "DELETE",
    resource: "Vehicle",
    resourceId: params.id,
    details: { plateNumber: vehicle.plateNumber },
  });

  return successResponse({ deleted: true });
}
