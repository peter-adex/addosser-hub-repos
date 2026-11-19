import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession, requireRole,
  successResponse, errorResponse,
  parseBody, paginatedResponse, getPagination,
  requirePermission,
} from "@/lib/api-helpers"
import { z } from "zod"

const createTripSchema = z.object({
  vehicleId:      z.string().cuid("Invalid vehicle ID"),
  driverId:       z.string().cuid("Invalid driver ID"),
  startLocation:  z.string().min(2, "Start location is required"),
  endLocation:    z.string().min(2, "End location is required"),
  startTime:      z.string().datetime("Invalid start time"),
  startOdometer:  z.number().min(0, "Start odometer must be 0 or greater"),
  purpose:        z.string().optional(),
  passengerCount: z.number().int().min(0).default(0),
  passengerNames: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requirePermission(session, "trips", "canView")
  if (denied) return denied

  const { skip, take, page, limit } = getPagination(request)
  const url      = new URL(request.url)
  const search   = url.searchParams.get("search")   ?? ""
  const status   = url.searchParams.get("status")   ?? ""
  const dateFrom = url.searchParams.get("dateFrom") ?? ""
  const dateTo   = url.searchParams.get("dateTo")   ?? ""

  let where: Record<string, any> = {}

  const requestingDriver = !session.user.isSystem
    ? await prisma.driver.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    : null

  if (requestingDriver) {
    where.driverId = requestingDriver.id
  } else {
    if (search) {
      where.OR = [
        { startLocation: { contains: search } },
        { endLocation:   { contains: search } },
        { purpose:       { contains: search } },
      ]
    }
  }

  if (status) where.status = status
  if (dateFrom || dateTo) {
    where.startTime = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo + "T23:59:59") } : {}),
    }
  }

  const [trips, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      skip, take,
      orderBy: { startTime: "desc" },
      include: {
        vehicle: { select: { id:true, plateNumber:true, make:true, model:true } },
        driver:  { include: { user: { select: { name:true } } } },
      },
    }),
    prisma.trip.count({ where }),
  ])

  return paginatedResponse(trips, total, page, limit)
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requirePermission(session, "trips", "canCreate")
  if (denied) return denied

  const { data, error } = await parseBody(request, createTripSchema)
  if (error) return error

  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } })
    if (!vehicle)                         return errorResponse("Vehicle not found", 404)
    if (vehicle.status === "retired")     return errorResponse("Cannot log a trip for a retired vehicle", 409)
    if (vehicle.status === "maintenance") return errorResponse("Vehicle is currently in maintenance", 409)

    const ongoingTrip = await prisma.trip.findFirst({
      where: { vehicleId: data.vehicleId, status: "ongoing" },
    })
    if (ongoingTrip) {
      return errorResponse("This vehicle already has an ongoing trip. End the current trip before logging a new one.", 409)
    }

    const trip = await prisma.trip.create({
      data: {
        vehicleId:      data.vehicleId,
        driverId:       data.driverId,
        startLocation:  data.startLocation,
        endLocation:    data.endLocation,
        startTime:      new Date(data.startTime),
        startOdometer:  data.startOdometer,
        purpose:        data.purpose,
        passengerCount: data.passengerCount,
        passengerNames: data.passengerNames,
        status:         "ongoing",
        isLocked:       false,
        createdById:    session.user.id,
      },
      include: {
        vehicle: { select: { plateNumber:true, make:true, model:true } },
        driver:  { include: { user: { select: { name:true } } } },
      },
    })

    await prisma.vehicle.update({
      where: { id: data.vehicleId },
      data:  { status: "active" },
    })

    return successResponse(trip, 201)
  } catch (err) {
    console.error("[POST /api/trips]", err)
    return errorResponse("Failed to log trip", 500)
  }
}
