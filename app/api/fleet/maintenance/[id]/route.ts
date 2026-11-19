import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession, requireRole,
  successResponse, errorResponse, parseBody,
  requirePermission,} from "@/lib/api-helpers"
import { z } from "zod"

const updateSchema = z.object({
  type:        z.string().min(2).optional(),
  description: z.string().optional(),
  date:        z.string().datetime().optional(),
  costNgn:     z.number().positive().optional(),
  vendorId:    z.string().cuid().optional().nullable(),
  nextDueDate: z.string().datetime().optional().nullable(),
  nextDueKm:   z.number().positive().optional().nullable(),
}).strict()

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requirePermission(session, "maintenance", "canView")
  if (denied) return denied

  const record = await prisma.maintenanceRecord.findUnique({
    where: { id: params.id },
    include: {
      vehicle: { select: { plateNumber:true, make:true, model:true } },
      vendor:  { select: { id:true, name:true } },
    },
  })
  if (!record) return errorResponse("Maintenance record not found", 404)
  return successResponse(record)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requirePermission(session, "maintenance", "canEdit")
  if (denied) return denied

  const record = await prisma.maintenanceRecord.findUnique({ where: { id: params.id } })
  if (!record) return errorResponse("Maintenance record not found", 404)

  const { data, error } = await parseBody(request, updateSchema)
  if (error) return error

  const updated = await prisma.maintenanceRecord.update({
    where: { id: params.id },
    data: {
      ...data,
      date:        data.date        ? new Date(data.date)        : undefined,
      nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
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
  const denied = requirePermission(session, "maintenance", "canDelete")
  if (denied) return denied

  const record = await prisma.maintenanceRecord.findUnique({ where: { id: params.id } })
  if (!record) return errorResponse("Maintenance record not found", 404)

  await prisma.maintenanceRecord.delete({ where: { id: params.id } })
  return successResponse({ message: "Maintenance record deleted" })
}
