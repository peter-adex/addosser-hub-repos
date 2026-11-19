import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession, requireRole,
  successResponse, errorResponse, parseBody,
  requirePermission,} from "@/lib/api-helpers"
import { z } from "zod"

const endTripSchema = z.object({
  endOdometer: z.number().min(0, "End odometer is required"),
  endTime:     z.string().datetime().optional(),
})

const adminEditTripSchema = z.object({
  endOdometer:    z.number().min(0).optional(),
  endTime:        z.string().datetime().optional(),
  startOdometer:  z.number().min(0).optional(),
  purpose:        z.string().optional(),
  passengerCount: z.number().int().min(0).optional(),
  passengerNames: z.string().optional(),
  status:         z.enum(["ongoing","completed","cancelled"]).optional(),
  isLocked:       z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  if (session.user.role === "hr_advisor") return errorResponse("Forbidden", 403)

  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    include: {
      vehicle: { select: { plateNumber:true, make:true, model:true, mileage:true } },
      driver:  { include: { user: { select: { name:true, email:true } } } },
    },
  })
  if (!trip) return errorResponse("Trip not found", 404)

  if (!session.user.isSystem) {
    const requestingDriver = await prisma.driver.findUnique({ where: { userId: session.user.id } })
    if (requestingDriver && requestingDriver.id !== trip.driverId) return errorResponse("Access denied", 403)
  }

  return successResponse(trip)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  if (session.user.role === "hr_advisor") return errorResponse("Forbidden", 403)

  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    include: { vehicle: true },
  })
  if (!trip) return errorResponse("Trip not found", 404)

  const requestingDriverForEnd = !session.user.isSystem
    ? await prisma.driver.findUnique({ where: { userId: session.user.id } })
    : null

  if (requestingDriverForEnd) {
    if (requestingDriverForEnd.id !== trip.driverId) return errorResponse("Access denied", 403)
    if (trip.isLocked) return errorResponse("This trip is locked and can no longer be edited", 403)
    if (trip.status !== "ongoing")    return errorResponse("Only ongoing trips can be ended", 409)

    const { data, error } = await parseBody(request, endTripSchema)
    if (error) return error

    if (data.endOdometer < trip.startOdometer) {
      return errorResponse(
        `End odometer (${data.endOdometer} km) cannot be less than start odometer (${trip.startOdometer} km)`,
        400
      )
    }

    const distanceKm = data.endOdometer - trip.startOdometer
    const endTime    = data.endTime ? new Date(data.endTime) : new Date()

    const [updatedTrip] = await prisma.$transaction([
      prisma.trip.update({
        where: { id: params.id },
        data: {
          endOdometer: data.endOdometer,
          endTime,
          distanceKm,
          status:   "completed",
          isLocked: true,
        },
      }),
      prisma.vehicle.update({
        where: { id: trip.vehicleId },
        data:  { mileage: data.endOdometer },
      }),
    ])

    return successResponse(updatedTrip)
  }

  const denied = requirePermission(session, "trips", "canEdit")
  if (denied) return denied

  if (trip.isLocked && !session.user.isSystem) {
    return errorResponse("This trip is locked. Only an Admin can edit locked trips.", 403)
  }

  const { data, error } = await parseBody(request, adminEditTripSchema)
  if (error) return error

  const endOdometer  = data.endOdometer  ?? trip.endOdometer
  const startOdometer = data.startOdometer ?? trip.startOdometer
  const distanceKm   = endOdometer != null ? endOdometer - startOdometer : undefined

  const updated = await prisma.trip.update({
    where: { id: params.id },
    data: {
      ...data,
      endTime:     data.endTime ? new Date(data.endTime) : undefined,
      distanceKm,
    },
  })

  if (data.endOdometer && data.endOdometer > (trip.vehicle?.mileage ?? 0)) {
    await prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data:  { mileage: data.endOdometer },
    })
  }

  return successResponse(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requirePermission(session, "trips", "canDelete")
  if (denied) return denied

  const trip = await prisma.trip.findUnique({ where: { id: params.id } })
  if (!trip) return errorResponse("Trip not found", 404)

  await prisma.trip.delete({ where: { id: params.id } })
  return successResponse({ message: "Trip deleted" })
}
