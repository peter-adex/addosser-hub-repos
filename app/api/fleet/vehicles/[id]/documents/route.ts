import { NextRequest }  from "next/server"
import { prisma }       from "@/lib/prisma"
import {
  getRequiredSession,
  successResponse, errorResponse,
  requirePermission,} from "@/lib/api-helpers"
import { z } from "zod"
import { deleteObject } from "@/lib/storage"
import { resolveDocumentType } from "@/lib/vehicle-document-types"

function requireDocumentPermission(
  session: Parameters<typeof requirePermission>[0],
  action: "canView" | "canCreate" | "canEdit" | "canDelete",
) {
  const viaVehicles = requirePermission(session, "vehicles", action)
  if (!viaVehicles) return null
  const viaRegister = requirePermission(session, "vehicle-document-register", action)
  if (!viaRegister) return null
  return viaVehicles
}

const addDocSchema = z.object({
  name:           z.string().min(1, "Document name is required"),
  documentTypeId: z.string().min(1, "Document type is required"),
  url:         z.string().refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Valid URL required").optional(),
  publicId:    z.string().optional(),
  storageProvider: z.string().optional(),
  storageKey:      z.string().optional(),
  fileSize:    z.number().optional(),
  mimeType:    z.string().optional(),
  expiryDate:  z.string().optional(),
})

const updateDocSchema = z.object({
  documentId:     z.string().min(1, "documentId is required"),
  name:           z.string().min(1).optional(),
  documentTypeId: z.string().min(1).optional(),
  url:            z.string().refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Valid URL required").optional().nullable(),
  publicId:       z.string().optional().nullable(),
  storageProvider:z.string().optional().nullable(),
  storageKey:     z.string().optional().nullable(),
  fileSize:       z.number().optional().nullable(),
  mimeType:       z.string().optional().nullable(),
  expiryDate:     z.string().optional().nullable(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requireDocumentPermission(session, "canView")
  if (denied) return denied

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      plateNumber: true,
      documents: {
        orderBy: { uploadedAt: "desc" },
        include: {
          documentType: { select: { id: true, name: true, isActive: true } },
        },
      },
    },
  })
  if (!vehicle) return errorResponse("Vehicle not found", 404)

  return successResponse(vehicle)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requireDocumentPermission(session, "canCreate")
  if (denied) return denied

  const vehicle = await prisma.vehicle.findUnique({ where: { id: params.id } })
  if (!vehicle) return errorResponse("Vehicle not found", 404)

  const body = await request.json().catch(() => ({}))
  const result = addDocSchema.safeParse(body)
  if (!result.success) {
    return errorResponse(result.error.errors.map(e => e.message).join(", "), 400)
  }
  const data = result.data

  const docType = await resolveDocumentType(data.documentTypeId)
  if (!docType) return errorResponse("Invalid or inactive document type", 400)

  const existingOfType = await prisma.vehicleDocument.findFirst({
    where: { vehicleId: params.id, documentTypeId: docType.id },
  })
  if (existingOfType) {
    return errorResponse(`A ${docType.name} document already exists for this vehicle`, 409)
  }

  const doc = await prisma.vehicleDocument.create({
    data: {
      vehicleId:    params.id,
      name:         data.name,
      type:         docType.name,
      documentTypeId: docType.id,
      url:          data.url || null,
      publicId:     data.publicId,
      storageProvider: data.storageProvider,
      storageKey:      data.storageKey,
      fileSize:     data.fileSize,
      mimeType:     data.mimeType,
      expiryDate:   data.expiryDate ? new Date(data.expiryDate) : undefined,
      uploadedById: session.user.id,
    },
  })
  return successResponse(doc, 201)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requireDocumentPermission(session, "canEdit")
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const result = updateDocSchema.safeParse(body)
  if (!result.success) {
    return errorResponse(result.error.errors.map(e => e.message).join(", "), 400)
  }
  const data = result.data

  const existing = await prisma.vehicleDocument.findFirst({
    where: { id: data.documentId, vehicleId: params.id },
  })
  if (!existing) return errorResponse("Document not found", 404)

  let typeUpdate: { type?: string; documentTypeId?: string } = {}
  if (data.documentTypeId) {
    const docType = await resolveDocumentType(data.documentTypeId)
    if (!docType) return errorResponse("Invalid or inactive document type", 400)
    typeUpdate = { type: docType.name, documentTypeId: docType.id }
  }

  const replacingFile = data.storageKey !== undefined && data.storageKey !== existing.storageKey
  const oldStorageKey = existing.storageKey

  const updated = await prisma.vehicleDocument.update({
    where: { id: data.documentId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...typeUpdate,
      ...(data.url !== undefined ? { url: data.url || null } : {}),
      ...(data.publicId !== undefined ? { publicId: data.publicId } : {}),
      ...(data.storageProvider !== undefined ? { storageProvider: data.storageProvider } : {}),
      ...(data.storageKey !== undefined ? { storageKey: data.storageKey } : {}),
      ...(data.fileSize !== undefined ? { fileSize: data.fileSize } : {}),
      ...(data.mimeType !== undefined ? { mimeType: data.mimeType } : {}),
      ...(data.expiryDate !== undefined
        ? { expiryDate: data.expiryDate ? new Date(data.expiryDate) : null }
        : {}),
    },
  })

  if (replacingFile && oldStorageKey) {
    await deleteObject(oldStorageKey).catch((err) =>
      console.error("[PATCH /api/fleet/vehicles/:id/documents] failed to delete replaced storage object", oldStorageKey, err),
    )
  }

  return successResponse(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getRequiredSession()
  if (!session) return errorResponse("Unauthorized", 401)
  const denied = requireDocumentPermission(session, "canDelete")
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const { documentId } = body
  if (!documentId) return errorResponse("documentId is required", 400)

  const doc = await prisma.vehicleDocument.findFirst({
    where: { id: documentId, vehicleId: params.id },
  })
  if (!doc) return errorResponse("Document not found", 404)

  await prisma.vehicleDocument.delete({ where: { id: documentId } })
  if (doc.storageKey) {
    await deleteObject(doc.storageKey).catch((err) =>
      console.error("[DELETE /api/fleet/vehicles/:id/documents] failed to delete storage object", doc.storageKey, err),
    )
  }
  return successResponse({ message: "Document deleted", publicId: doc.publicId })
}
