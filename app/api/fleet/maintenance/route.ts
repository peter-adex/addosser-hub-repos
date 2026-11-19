import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession, requireRole,
  successResponse, errorResponse,
  parseBody, paginatedResponse, getPagination,
  requirePermission,} from "@/lib/api-helpers"
import { z } from "zod"

const createMaintenanceSchema = z.object({
  vehicleId:   z.string().cuid("Invalid vehicle ID"),
  vendorId:    z.string().cuid().optional(),
  type:        z.string().min(2, "Maintenance type is required"),
  description: z.string().optional(),
  date:        z.string().datetime("Invalid date"),
  costNgn:     z.number().positive("Cost must be greater than 0"),
  nextDueDate: z.string().datetime().optional(),
  nextDueKm:   z.number().positive().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const denied = requirePermission(session, "maintenance", "canView")
  if (denied) return denied

  const { skip, take, page, limit } = getPagination(request)
  const url      = new URL(request.url)
  const dateFrom = url.searchParams.get("dateFrom") ?? ""
  const dateTo   = url.searchParams.get("dateTo")   ?? ""
  const vehicleId = url.searchParams.get("vehicleId") ?? ""

  const where: Record<string, any> = {}
  if (vehicleId) where.vehicleId = vehicleId
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo + "T23:59:59") } : {}),
    }
  }

  const [records, total] = await prisma.$transaction([
    prisma.maintenanceRecord.findMany({
      where, skip, take,
      orderBy: { date: "desc" },
      include: {
        vehicle: { select: { plateNumber:true, make:true, model:true } },
        vendor:  { select: { name:true } },
      },
    }),
    prisma.maintenanceRecord.count({ where }),
  ])

  return paginatedResponse(records, total, page, limit)
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const denied = requirePermission(session, "maintenance", "canCreate")
  if (denied) return denied

  const { data, error } = await parseBody(request, createMaintenanceSchema)
  if (error) return error

  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } })
  if (!vehicle) return errorResponse("Vehicle not found", 404)

  try {
    const record = await prisma.maintenanceRecord.create({
      data: {
        vehicleId:   data.vehicleId,
        vendorId:    data.vendorId,
        type:        data.type,
        description: data.description,
        date:        new Date(data.date),
        costNgn:     data.costNgn,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
        nextDueKm:   data.nextDueKm,
      },
      include: {
        vehicle: { select: { plateNumber:true } },
        vendor:  { select: { name:true } },
      },
    })

    if (vehicle.status === "maintenance") {
      await prisma.vehicle.update({
        where: { id: data.vehicleId },
        data:  { status: "active" },
      })
    }

    return successResponse(record, 201)
  } catch (err) {
    console.error("[POST /api/maintenance]", err)
    return errorResponse("Failed to create maintenance record", 500)
  }
}
