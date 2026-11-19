import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import { getRequiredSession, successResponse, errorResponse } from "@/lib/api-helpers"
import { NOTIFICATION_TYPES } from "@/lib/notification-types"

export async function GET(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const saved = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
  })

  const savedMap = Object.fromEntries(saved.map(p => [p.type, p.enabled]))

  const merged = NOTIFICATION_TYPES.map(t => ({
    key:     t.key,
    label:   t.label,
    desc:    t.desc,
    enabled: savedMap[t.key] !== undefined ? savedMap[t.key] : t.default,
  }))

  return successResponse({ preferences: merged })
}

export async function PUT(request: NextRequest) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)

  const body = await request.json().catch(() => ({}))
  const updates: { key: string; enabled: boolean }[] = body.preferences ?? []

  if (!Array.isArray(updates) || updates.length === 0) {
    return errorResponse("preferences array is required", 400)
  }

  await Promise.all(
    updates.map(({ key, enabled }) =>
      prisma.notificationPreference.upsert({
        where:  { userId_type: { userId: session.user.id, type: key } },
        create: { userId: session.user.id, type: key, enabled },
        update: { enabled },
      })
    )
  )

  return successResponse({ message: `${updates.length} preference(s) saved` })
}
