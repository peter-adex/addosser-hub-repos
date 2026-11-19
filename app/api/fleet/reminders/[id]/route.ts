import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession, requireRole,
  successResponse, errorResponse,
  requirePermission,} from "@/lib/api-helpers"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const denied = requirePermission(session, "reminders", "canEdit")
  if (denied) return denied

  const reminder = await prisma.reminder.findUnique({ where: { id: params.id } })
  if (!reminder) return errorResponse("Reminder not found", 404)

  const body   = await request.json().catch(() => ({}))
  const action = body.action ?? "acknowledge"

  if (action === "acknowledge") {
    const updated = await prisma.reminder.update({
      where: { id: params.id },
      data: {
        status:          "acknowledged",
        acknowledgedById: session.user.id,
        acknowledgedAt:  new Date(),
      },
    })
    return successResponse(updated)
  }

  if (action === "complete") {
    const updated = await prisma.reminder.update({
      where: { id: params.id },
      data: {
        status:      "completed",
        completedAt: new Date(),
      },
    })
    return successResponse(updated)
  }

  return errorResponse("Invalid action. Use 'acknowledge' or 'complete'.", 400)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const denied = requirePermission(session, "reminders", "canDelete")
  if (denied) return denied

  const reminder = await prisma.reminder.findUnique({ where: { id: params.id } })
  if (!reminder) return errorResponse("Reminder not found", 404)

  await prisma.reminder.delete({ where: { id: params.id } })
  return successResponse({ message: "Reminder deleted" })
}
