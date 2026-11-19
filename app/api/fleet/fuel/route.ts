import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession, requireRole,
  successResponse, errorResponse,
  parseBody, paginatedResponse, getPagination,
  requirePermission,
} from "@/lib/api-helpers"
import { z } from "zod"

const createFuelLogSchema = z.object({
  vehicleId:    z.string().cuid("Invalid vehicle ID"),
  driverId:     z.string().cuid("Invalid driver ID"),
  date:         z.string().datetime("Invalid date"),
  litres:       z.number().positive("Litres must be greater than 0"),
  costPerLitre: z.number().positive("Cost per litre must be greater than 0"),
  odometerKm:   z.number().min(0, "Odometer reading must be 0 or greater"),
  station:      z.string().optional(),
  entityId:     z.string().cuid().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requirePermission(session, "fuel", "canView")
  if (denied) return denied

  const { skip, take, page, limit } = getPagination(request)
  const url      = new URL(request.url)
  const search   = url.searchParams.get("search")   ?? ""
  const entityId = url.searchParams.get("entityId") ?? ""
  const dateFrom = url.searchParams.get("dateFrom") ?? ""
  const dateTo   = url.searchParams.get("dateTo")   ?? ""

  const where: Record<string, any> = {}

  const requestingDriver = !session.user.isSystem
    ? await prisma.driver.findUnique({ where: { userId: session.user.id } })
    : null

  if (requestingDriver) {
    where.driverId = requestingDriver.id
  } else {
    if (search) {
      where.OR = [
        { vehicle: { plateNumber: { contains: search } } },
        { station: { contains: search } },
      ]
    }
    if (entityId) where.entityId = entityId
  }

  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo + "T23:59:59") } : {}),
    }
  }

  const [logs, total] = await prisma.$transaction([
    prisma.fuelLog.findMany({
      where,
      skip, take,
      orderBy: { date: "desc" },
      include: {
        vehicle: { select: { plateNumber:true, make:true, model:true } },
        driver:  { include: { user: { select: { name:true } } } },
      },
    }),
    prisma.fuelLog.count({ where }),
  ])

  return paginatedResponse(logs, total, page, limit)
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requirePermission(session, "fuel", "canCreate")
  if (denied) return denied

  const { data, error } = await parseBody(request, createFuelLogSchema)
  if (error) return error

  try {
    const totalCost = data.litres * data.costPerLitre

    const fuelLog = await prisma.fuelLog.create({
      data: {
        vehicleId:    data.vehicleId,
        driverId:     data.driverId,
        entityId:     data.entityId,
        date:         new Date(data.date),
        litres:       data.litres,
        costPerLitre: data.costPerLitre,
        totalCost,
        odometerKm:   data.odometerKm,
        station:      data.station,
      },
      include: {
        vehicle: { select: { plateNumber:true } },
        driver:  { include: { user: { select: { name:true } } } },
      },
    })

    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } })
    if (vehicle && data.odometerKm > vehicle.mileage) {
      await prisma.vehicle.update({
        where: { id: data.vehicleId },
        data:  { mileage: data.odometerKm },
      })
    }

    return successResponse(fuelLog, 201)
  } catch (err) {
    console.error("[POST /api/fuel]", err)
    return errorResponse("Failed to save fuel log", 500)
  }
}
