import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession, requireRole,
  successResponse, errorResponse,
  parseBody, paginatedResponse, getPagination,
  requirePermission,} from "@/lib/api-helpers"
import { z } from "zod"

const createReminderSchema = z.object({
  vehicleId:       z.string().cuid("Invalid vehicle ID"),
  type:            z.enum(["service","document_renewal"]),
  documentType:    z.string().optional(),
  title:           z.string().min(3, "Title is required"),
  dueDate:         z.string().datetime("Invalid due date"),
  dueMileageKm:    z.number().positive().optional(),
  notifyDaysBefore:z.number().int().min(1).max(90).default(14),
  notes:           z.string().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const denied = requirePermission(session, "reminders", "canView")
  if (denied) return denied

  const { skip, take, page, limit } = getPagination(request)
  const url    = new URL(request.url)
  const status = url.searchParams.get("status") ?? ""

  const where: Record<string, any> = {}
  if (status) where.status = status

  const now = new Date()
  await prisma.reminder.updateMany({
    where: { status: "pending", dueDate: { lt: now } },
    data:  { status: "overdue" },
  })

  const [reminders, total] = await prisma.$transaction([
    prisma.reminder.findMany({
      where, skip, take,
      orderBy: { dueDate: "asc" },
      include: {
        vehicle: { select: { plateNumber:true, make:true, model:true } },
      },
    }),
    prisma.reminder.count({ where }),
  ])

  return paginatedResponse(reminders, total, page, limit)
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const denied = requirePermission(session, "reminders", "canCreate")
  if (denied) return denied

  const { data, error } = await parseBody(request, createReminderSchema)
  if (error) return error

  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } })
  if (!vehicle) return errorResponse("Vehicle not found", 404)

  const dueDate = new Date(data.dueDate)
  const status  = dueDate < new Date() ? "overdue" : "pending"

  const reminder = await prisma.reminder.create({
    data: {
      vehicleId:        data.vehicleId,
      type:             data.type,
      documentType:     data.documentType,
      title:            data.title,
      dueDate,
      dueMileageKm:     data.dueMileageKm,
      notifyDaysBefore: data.notifyDaysBefore,
      notes:            data.notes,
      status,
      createdById:      session.user.id,
    },
    include: {
      vehicle: { select: { plateNumber:true } },
    },
  })

  return successResponse(reminder, 201)
}
