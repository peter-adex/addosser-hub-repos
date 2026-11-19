import { logFleetAudit as logAudit } from "@/lib/audit";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  requirePermission,
  successResponse,
  errorResponse,
  parseBody,
  paginatedResponse,
  getPagination,
} from "@/lib/api-helpers";
import { z } from "zod";

const createDriverSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Phone number is required"),
  entityId: z.string().cuid("Valid entity ID is required"),
  assignedVehicleId: z.string().cuid().optional(),
  supervisorId: z.string().cuid().optional(),
  licenses: z
    .array(
      z.object({
        type: z.enum([
          "federal_road_safety",
          "state_drivers_license",
          "vehicle_inspection",
          "commercial",
          "heavy_duty",
          "motorcycle",
          "other",
        ]),
        licenseNumber: z.string().min(3, "License number is required"),
        issuingAuthority: z.string().min(2, "Issuing authority is required"),
        issueDate: z.string().optional(),
        expiryDate: z.string().datetime("Valid expiry date is required"),
        isPrimary: z.boolean(),
      }),
    )
    .min(1, "At least one license is required"),
  photoUrl: z
    .string()
    .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v))
    .optional(),
  photoStorageProvider: z.string().optional(),
  photoStorageKey: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "drivers", "canView");
  if (denied) return denied;

  const { skip, take, page, limit } = getPagination(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "";

  const where: Record<string, any> = {};

  if (search) {
    where.OR = [
      { user: { name: { contains: search } } },
      { user: { email: { contains: search } } },
      { user: { phone: { contains: search } } },
      { licenses: { some: { licenseNumber: { contains: search } } } },
    ];
  }
  if (status) where.status = status;

  const [drivers, total] = await prisma.$transaction([
    prisma.driver.findMany({
      where,
      skip,
      take,
      orderBy: { user: { name: "asc" } },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        entity: { select: { id: true, name: true, code: true } },
        licenses: { orderBy: { isPrimary: "desc" } },
        assignedVehicle: {
          select: {
            id: true,
            plateNumber: true,
            make: true,
            model: true,
            status: true,
          },
        },
      },
    }),
    prisma.driver.count({ where }),
  ]);

  return paginatedResponse(drivers, total, page, limit);
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "drivers", "canCreate");
  if (denied) return denied;

  const { data, error } = await parseBody(request, createDriverSchema);
  if (error) return error;

  const primaryCount = data.licenses.filter((l) => l.isPrimary).length;
  if (primaryCount !== 1) {
    return errorResponse("Exactly one license must be marked as primary", 400);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  if (existingUser) {
    return errorResponse(`Email '${data.email}' is already registered`, 409);
  }

  if (data.assignedVehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: data.assignedVehicleId },
    });
    if (!vehicle) return errorResponse("Vehicle not found", 404);
    if (
      vehicle.allocationStatus !== "available" &&
      vehicle.vehicleUse === "pool"
    ) {
      return errorResponse(
        "This vehicle is already allocated. Deallocate it first.",
        409,
      );
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {

      const fleetDriverRole = await tx.role.findUnique({
        where: {
          name: "Fleet Driver",
        },
      });

      if (!fleetDriverRole) {
        throw new Error(
          "Fleet Driver role is not configured. Please run the application seed first.",
        );
      }

      const user = await tx.user.create({
        data: {
          name: data.name.trim(),
          email: data.email.toLowerCase().trim(),
          passwordHash: "",
          roleId: fleetDriverRole.id,
          entityId: data.entityId,
          isActive: true,
          mustChangePassword: false,
        },
      });

      const driver = await tx.driver.create({
        data: {
          userId: user.id,
          entityId: data.entityId,
          photoUrl: data.photoUrl,
          photoStorageProvider: data.photoStorageProvider,
          photoStorageKey: data.photoStorageKey,
          assignedVehicleId: data.assignedVehicleId,
          supervisorId: data.supervisorId,
          status: "active",
        },
      });

      await tx.driverLicense.createMany({
        data: data.licenses.map((lic) => ({
          driverId: driver.id,
          type: lic.type,
          licenseNumber: lic.licenseNumber.toUpperCase(),
          issuingAuthority: lic.issuingAuthority,
          issueDate: lic.issueDate ? new Date(lic.issueDate) : null,
          expiryDate: new Date(lic.expiryDate),
          isPrimary: lic.isPrimary,
        })),
      });

      if (data.assignedVehicleId) {
        await tx.vehicle.update({
          where: { id: data.assignedVehicleId },
          data: {
            assignedDriverId: driver.id,
            allocationStatus: "allocated_driver",
          },
        });
      }

      return driver;
    });

    const fullDriver = await prisma.driver.findUnique({
      where: { id: result.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        licenses: true,
      },
    });

    logAudit(request, {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      userRole: session.user.role,
      action: "CREATE",
      resource: "Driver",
      resourceId: result.id,
      details: { name: data.name, email: data.email },
    });

    return successResponse(fullDriver, 201);
  } catch (err) {
    console.error("[POST /api/drivers]", err);
    return errorResponse("Failed to create driver record", 500);
  }
}
