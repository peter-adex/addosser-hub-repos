import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  roleId: z.string().optional(),
  entityId: z.string().optional(),
  isActive: z.boolean().optional(),
  extraEntityIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { name, roleId, entityId, isActive, extraEntityIds } = parsed.data;

    const updatedUser = await prisma.$transaction(async (tx) => {
      if (extraEntityIds !== undefined) {
        await tx.userEntity.deleteMany({
          where: { userId: params.id },
        });

        const primaryId =
          entityId ||
          (
            await tx.user.findUnique({
              where: { id: params.id },
              select: { entityId: true },
            })
          )?.entityId;
        const allEntityIds = Array.from(
          new Set([primaryId, ...extraEntityIds].filter(Boolean)),
        ) as string[];

        if (allEntityIds.length > 0) {
          await tx.userEntity.createMany({
            data: allEntityIds.map((entId) => ({
              userId: params.id,
              entityId: entId,
            })),
          });
        }
      } else if (entityId !== undefined) {
        const existingAccess = await tx.userEntity.findFirst({
          where: { userId: params.id, entityId: entityId },
        });
        if (!existingAccess) {
          await tx.userEntity.create({
            data: { userId: params.id, entityId: entityId },
          });
        }
      }

      return tx.user.update({
        where: { id: params.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(roleId !== undefined ? { roleId } : {}),
          ...(entityId !== undefined ? { entityId } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
        include: {
          role: true,
          entity: true,
          entityAccess: { include: { entity: true } },
        },
      });
    });

    await logAudit({
      userId: (session.user as any).id,
      action: "USER_STATUS_TOGGLED",
      module: "admin",
      resourceId: params.id,
      afterData: JSON.stringify({ isActive }),
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error: any) {
    console.error("❌ BACKEND USER PATCH FAILURE:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
