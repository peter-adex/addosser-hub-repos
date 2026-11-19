import { logFleetAudit as logAudit } from "@/lib/audit"

import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession, requireRole,
  successResponse, errorResponse,
  parseBody, paginatedResponse, getPagination,
  requirePermission,} from "@/lib/api-helpers"
import { z }            from "zod"
import { resolveDocumentType } from "@/lib/vehicle-document-types"

const createVehicleSchema = z.object({
  plateNumber:        z.string().min(3, "Plate number is required"),
  make:               z.string().min(1, "Make is required"),
  model:              z.string().min(1, "Model is required"),
  year:               z.number().int().min(1990).max(new Date().getFullYear() + 1),
  category:           z.enum(["saloon","suv","jeep","truck","motorcycle"]),
  vehicleUse:         z.enum(["pool","status"]).default("pool"),
  colour:             z.string().optional(),
  chassisNumber:      z.string().min(3, "Chassis number is required"),
  engineNumber:       z.string().optional(),
  mileage:            z.number().min(0).default(0),
  purchaseDate:       z.string().optional(),
  acquisitionValueNgn:z.number().min(0).optional(),
  usefulLifeYears:    z.number().int().min(1).max(20).default(5),
  entityId:           z.string().cuid("Invalid entity ID"),
  locationId:         z.string().cuid().optional(),
  purchaseVendorId:   z.string().cuid().optional(),
  assignedDriverId:   z.string().cuid().optional(),

  statusStaffName:    z.string().optional(),
  statusStaffDept:    z.string().optional(),
  statusStaffRole:    z.string().optional(),
  statusStaffId:      z.string().optional(),
  statusStaffPhone:   z.string().optional(),
  statusStaffEmail:   z.string().email().optional().or(z.literal("")),

  photos: z
    .array(
      z.object({
        url: z.string().min(1),
        publicId: z.string().optional(),
        storageProvider: z.string().optional(),
        storageKey: z.string().optional(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .optional(),
  documents: z
    .array(
      z.object({
        name: z.string().min(1, "Document name is required"),
        documentTypeId: z.string().min(1, "Document type is required"),
        url: z.string().optional(),
        publicId: z.string().optional(),
        storageProvider: z.string().optional(),
        storageKey: z.string().optional(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        expiryDate: z.string().optional(),
      }),
    )
    .optional(),
})

export async function GET(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  if (session.user.role === "hr_advisor") {
    return errorResponse("HR Advisors do not have access to vehicle records", 403)
  }

  const { skip, take, page, limit } = getPagination(request)
  const url    = new URL(request.url)
  const search = url.searchParams.get("search") ?? ""
  const status = url.searchParams.get("status") ?? ""
  const entityId = url.searchParams.get("entityId") ?? ""
  const includeDocuments = url.searchParams.get("includeDocuments") === "true"

  let where: Record<string, any> = {}

  const requestingDriver = !session.user.isSystem
    ? await prisma.driver.findUnique({
        where: { userId: session.user.id },
        select: { assignedVehicleId: true },
      })
    : null

  if (requestingDriver) {
    const driver = requestingDriver

    if (!driver?.assignedVehicleId) {
      return successResponse({ items: [], pagination: { total: 0, page, limit, totalPages: 0, hasMore: false } })
    }

    where = { id: driver.assignedVehicleId }
  } else {
    if (search) {
      where.OR = [
        { plateNumber: { contains: search } },
        { make:        { contains: search } },
        { model:       { contains: search } },
        { statusStaffName: { contains: search } },
      ]
    }
    if (status)   where.status   = status
    if (entityId) where.entityId = entityId
  }

  const [vehicles, total] = await prisma.$transaction([
    prisma.vehicle.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        entity:   { select: { id: true, name: true, shortName: true, code: true } },
        location: { select: { id: true, name: true, city: true } },
        assignedDriver: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        images: { where: { isPrimary: true }, take: 1 },
        fuelEntitlement: {
          select: { type: true, amount: true, durationDays: true },
        },
        ...(includeDocuments
          ? {
              documents: {
                orderBy: { uploadedAt: "desc" as const },
                include: {
                  documentType: { select: { id: true, name: true, isActive: true } },
                },
              },
            }
          : {}),
      },
    }),
    prisma.vehicle.count({ where }),
  ])

  return paginatedResponse(vehicles, total, page, limit)
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const denied = requirePermission(session, "vehicles", "canCreate")
  if (denied) return denied

  const { data, error } = await parseBody(request, createVehicleSchema)
  if (error) return error

  try {
    const existing = await prisma.vehicle.findUnique({
      where: { plateNumber: data.plateNumber.toUpperCase() },
    })
    if (existing) {
      return errorResponse(`Plate number '${data.plateNumber}' is already registered`, 409)
    }

    const existingChassis = await prisma.vehicle.findFirst({
      where: { chassisNumber: data.chassisNumber.toUpperCase() },
    })
    if (existingChassis) {
      return errorResponse(`Chassis number is already registered to ${existingChassis.plateNumber}`, 409)
    }

    let resolvedDocTypes: { id: string; name: string }[] = []
    if (data.documents?.length) {
      const resolved = await Promise.all(
        data.documents.map(d => resolveDocumentType(d.documentTypeId)),
      )
      const badIndex = resolved.findIndex(t => !t)
      if (badIndex !== -1) {
        return errorResponse(
          `Document ${badIndex + 1}: invalid or inactive document type`,
          400,
        )
      }
      resolvedDocTypes = resolved as { id: string; name: string }[]

      const seen = new Map<string, number>()
      for (let i = 0; i < resolvedDocTypes.length; i++) {
        const typeId = resolvedDocTypes[i].id
        if (seen.has(typeId)) {
          return errorResponse(
            `Duplicate document type: "${resolvedDocTypes[i].name}" was selected more than once`,
            400,
          )
        }
        seen.set(typeId, i)
      }
    }

    let allocationStatus = "available"
    if (data.assignedDriverId)                         allocationStatus = "allocated_driver"
    if (data.vehicleUse === "status" && data.statusStaffName) allocationStatus = "allocated_status"

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber:          data.plateNumber.toUpperCase(),
        make:                 data.make,
        model:                data.model,
        year:                 data.year,
        category:             data.category,
        vehicleUse:           data.vehicleUse,
        colour:               data.colour,
        chassisNumber:        data.chassisNumber.toUpperCase(),
        engineNumber:         data.engineNumber?.toUpperCase(),
        mileage:              data.mileage,
        purchaseDate:         data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        acquisitionValueNgn:  data.acquisitionValueNgn,
        usefulLifeYears:      data.usefulLifeYears,
        allocationStatus,
        entityId:             data.entityId,
        locationId:           data.locationId,
        purchaseVendorId:     data.purchaseVendorId,
        assignedDriverId:     data.assignedDriverId,
        statusStaffName:      data.statusStaffName,
        statusStaffDept:      data.statusStaffDept,
        statusStaffRole:      data.statusStaffRole,
        statusStaffId:        data.statusStaffId,
        statusStaffPhone:     data.statusStaffPhone,
        statusStaffEmail:     data.statusStaffEmail,
      },
    })

    if (data.photos?.length) {
      await prisma.vehicleImage.createMany({
        data: data.photos.map(p => ({
          vehicleId: vehicle.id,
          url:       p.url,
          publicId:  p.publicId,
          storageProvider: p.storageProvider,
          storageKey:      p.storageKey,
          isPrimary: p.isPrimary,
        })),
      })
    }

    if (data.documents?.length) {
      await prisma.vehicleDocument.createMany({
        data: data.documents.map((d, i) => ({
          vehicleId:    vehicle.id,
          name:         d.name,
          type:         resolvedDocTypes[i].name,
          documentTypeId: resolvedDocTypes[i].id,
          url:          d.url || undefined,
          publicId:     d.publicId,
          storageProvider: d.storageProvider,
          storageKey:      d.storageKey,
          fileSize:     d.fileSize,
          mimeType:     d.mimeType,
          expiryDate:   d.expiryDate ? new Date(d.expiryDate) : undefined,
          uploadedById: session.user.id,
        })),
      })
    }

    if (data.assignedDriverId) {
      await prisma.driver.update({
        where: { id: data.assignedDriverId },
        data:  { assignedVehicleId: vehicle.id },
      })
    }

    logAudit(request, {
      userId: session.user.id, userEmail: session.user.email,
      userName: session.user.name, userRole: session.user.role,
      action: "CREATE", resource: "Vehicle", resourceId: vehicle.id,
      details: { plateNumber: vehicle.plateNumber, make: vehicle.make, model: vehicle.model },
    })
    const withImages = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      include: {
        entity:        { select: { name:true, code:true } },
        assignedDriver:{ include: { user: { select: { name:true, email:true } } } },
        images:        true,
      },
    })
    return successResponse(withImages, 201)

  } catch (err) {
    console.error("[POST /api/vehicles]", err)
    return errorResponse("Failed to create vehicle. Please try again.", 500)
  }
}
