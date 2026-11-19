import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession, requireRole,
  successResponse, errorResponse,
  requirePermission,} from "@/lib/api-helpers"
import { z } from "zod"
import { logFleetAudit as logAudit } from "@/lib/audit"

const updateSchema = z.object({
  name:                       z.string().min(2).optional(),
  shortName:                  z.string().optional().nullable(),
  code:                       z.string().min(2).max(20).optional(),
  annualMaintenanceBudgetNgn: z.number().min(0).optional(),
  isActive:                   z.boolean().optional(),
  phone:                      z.string().optional().nullable(),
  email:                      z.string().email().optional().nullable().or(z.literal("")),
  city:                       z.string().optional().nullable(),
  state:                      z.string().optional().nullable(),
  description:                z.string().optional().nullable(),
  status:                     z.enum(["active","inactive"]).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const entity = await prisma.entity.findUnique({
    where: { id: params.id },
    include: {
      locations: { orderBy: { isHeadOffice: "desc" } },
      _count: {
        select: { vehicles: true, drivers: true, users: true },
      },
    },
  })
  if (!entity) return errorResponse("Entity not found", 404)
  return successResponse(entity)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requirePermission(session, "entities", "canEdit")
  if (denied) return denied

  const entity = await prisma.entity.findUnique({ where: { id: params.id } })
  if (!entity) return errorResponse("Entity not found", 404)

  const body = await request.json().catch(() => ({}))
  const result = updateSchema.safeParse(body)
  if (!result.success) {
    return errorResponse(result.error.errors.map(e => e.message).join(", "), 400)
  }
  const data = result.data

  if (data.code && data.code !== entity.code) {
    const existing = await prisma.entity.findFirst({
      where: { code: data.code.toUpperCase(), NOT: { id: params.id } },
    })
    if (existing) return errorResponse(`Code "${data.code}" is already in use`, 409)
  }

  const updated = await prisma.entity.update({
    where: { id: params.id },
    data: {
      ...(data.name                       !== undefined ? { name:                       data.name }                  : {}),
      ...(data.shortName                  !== undefined ? { shortName:                  data.shortName }             : {}),
      ...(data.code                       !== undefined ? { code:                       data.code.toUpperCase() }    : {}),
      ...(data.annualMaintenanceBudgetNgn !== undefined ? { annualMaintenanceBudgetNgn: data.annualMaintenanceBudgetNgn } : {}),
      ...(data.isActive                   !== undefined ? { isActive:                   data.isActive, status: data.isActive ? "active" : "inactive" } : {}),
      ...(data.status                     !== undefined ? { status:                     data.status }                : {}),
      ...(data.phone                      !== undefined ? { phone:                      data.phone }                 : {}),
      ...(data.email                      !== undefined ? { email:                      data.email }                 : {}),
      ...(data.city                       !== undefined ? { city:                       data.city }                  : {}),
      ...(data.state                      !== undefined ? { state:                      data.state }                 : {}),
      ...(data.description                !== undefined ? { description:                data.description }           : {}),
    },
    include: {
      locations: { orderBy: { isHeadOffice: "desc" } },
    },
  })

  logAudit(request, {
    userId: session.user.id, userEmail: session.user.email,
    userName: session.user.name, userRole: session.user.role,
    action: "UPDATE", resource: "Entity", resourceId: params.id,
    details: { name: updated.name, code: updated.code },
  })

  return successResponse(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requirePermission(session, "entities", "canDelete")
  if (denied) return denied

  const entity = await prisma.entity.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { vehicles: true, users: true, drivers: true } },
    },
  })
  if (!entity) return errorResponse("Entity not found", 404)

  const total = entity._count.vehicles + entity._count.users + entity._count.drivers
  if (total > 0) {
    return errorResponse(
      `Cannot delete "${entity.name}" — it has ${entity._count.vehicles} vehicle(s), ` +
      `${entity._count.drivers} driver(s), and ${entity._count.users} user(s). ` +
      `Reassign or deactivate them first.`,
      409
    )
  }

  await prisma.entity.delete({ where: { id: params.id } })

  logAudit(request, {
    userId: session.user.id, userEmail: session.user.email,
    userName: session.user.name, userRole: session.user.role,
    action: "DELETE", resource: "Entity", resourceId: params.id,
    details: { name: entity.name, code: entity.code },
  })

  return successResponse({ message: "Entity deleted" })
}
