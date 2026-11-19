import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession, requireRole,
  successResponse, errorResponse,
  requirePermission,} from "@/lib/api-helpers"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  if (session.user.role === "hr_advisor") return errorResponse("Forbidden", 403)

  const log = await prisma.fuelLog.findUnique({
    where: { id: params.id },
    include: {
      vehicle: { select: { plateNumber:true, make:true, model:true } },
      driver:  { include: { user: { select: { name:true } } } },
    },
  })
  if (!log) return errorResponse("Fuel log not found", 404)

  if (!session.user.isSystem) {
    const requestingDriver = await prisma.driver.findUnique({ where: { userId: session.user.id } })
    if (requestingDriver && requestingDriver.id !== log.driverId) return errorResponse("Access denied", 403)
  }

  return successResponse(log)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const denied = requirePermission(session, "fuel", "canEdit")
  if (denied) return denied

  const log = await prisma.fuelLog.findUnique({ where: { id: params.id } })
  if (!log) return errorResponse("Fuel log not found", 404)

  const body = await request.json().catch(() => ({}))
  const { date, litres, costPerLitre, odometerKm, station } = body

  const newLitres       = litres       ?? log.litres
  const newCostPerLitre = costPerLitre ?? log.costPerLitre
  const totalCost       = newLitres * newCostPerLitre

  const updated = await prisma.fuelLog.update({
    where: { id: params.id },
    data: {
      date:         date ? new Date(date) : undefined,
      litres:       newLitres,
      costPerLitre: newCostPerLitre,
      totalCost,
      odometerKm:   odometerKm ?? undefined,
      station:      station    ?? undefined,
    },
  })

  return successResponse(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const denied = requirePermission(session, "fuel", "canDelete")
  if (denied) return denied

  const log = await prisma.fuelLog.findUnique({ where: { id: params.id } })
  if (!log) return errorResponse("Fuel log not found", 404)

  await prisma.fuelLog.delete({ where: { id: params.id } })
  return successResponse({ message: "Fuel log deleted" })
}
