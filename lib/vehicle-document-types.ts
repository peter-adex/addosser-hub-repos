import { prisma } from "@/lib/prisma";

export interface ResolvedDocumentType {
  id: string;
  name: string;
}

export async function resolveDocumentType(
  documentTypeId: string,
  { requireActive = true }: { requireActive?: boolean } = {},
): Promise<ResolvedDocumentType | null> {
  const type = await prisma.vehicleDocumentType.findUnique({
    where: { id: documentTypeId },
    select: { id: true, name: true, isActive: true },
  });
  if (!type) return null;
  if (requireActive && !type.isActive) return null;
  return { id: type.id, name: type.name };
}
