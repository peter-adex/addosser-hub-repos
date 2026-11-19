import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGranularPermission } from "@/lib/permissions";
import { ACCOUNT_NUMBER_REGEX, ACCOUNT_NUMBER_ERROR_MESSAGE } from "@/lib/vendor-validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;
    const allowedEntityIds = user.isSystem ? null : (user.allowedEntityIds ?? null);

    const { searchParams } = new URL(req.url);
    const search   = searchParams.get("search") || "";
    const status   = searchParams.get("status") || "";
    const entityId = searchParams.get("entityId") || "";

    const where: any = {
      ...(allowedEntityIds
        ? { AND: [{ OR: [{ entityId: { in: allowedEntityIds } }, { entityId: null }] }] }
        : {}),
      ...(entityId && entityId !== "ALL" ? { entityId } : {}),
      ...(status === "active"   ? { isActive: true }                : {}),
      ...(status === "inactive" ? { isActive: false }               : {}),
      ...(status === "approved" ? { isActive: true, isApproved: true } : {}),
      ...(status === "pending"  ? { isApproved: false }             : {}),
    };

    if (search.trim()) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { name:    { contains: search } },
            { code:    { contains: search } },
            { email:   { contains: search } },
            { taxId:   { contains: search } },
            { rcNumber:{ contains: search } },
            { contactPerson: { contains: search } },
          ],
        },
      ];
    }

    const vendors = await prisma.vendor.findMany({
      where,
      include: {
        entity:    { select: { name: true, code: true } },
        createdBy: { select: { name: true } },
        _count:    { select: { invoices: true } },
      },
      orderBy: { name: "asc" },
      take: 500,
    });

    const entities = await prisma.entity.findMany({
      where: {
        isActive: true,
        ...(allowedEntityIds ? { id: { in: allowedEntityIds } } : {}),
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ vendors, entities });
  } catch (err: any) {
    console.error("[GET /api/vendors]", err);
    return NextResponse.json({ error: "Failed to load vendors" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  entityId:        z.string().optional().nullable().or(z.literal("")),
  name:            z.string().min(1, "Vendor name is required"),
  email:           z.string().email().optional().nullable().or(z.literal("")),
  phone:           z.string().optional().nullable(),
  address:         z.string().optional().nullable(),
  website:         z.string().optional().nullable(),
  taxId:           z.string().optional().nullable(),
  rcNumber:        z.string().optional().nullable(),
  contactPerson:   z.string().optional().nullable(),
  contactEmail:    z.string().email().optional().nullable().or(z.literal("")),
  contactPhone:    z.string().optional().nullable(),
  bankName:        z.string().optional().nullable(),
  bankAccountNo:   z
    .string()
    .regex(ACCOUNT_NUMBER_REGEX, ACCOUNT_NUMBER_ERROR_MESSAGE)
    .optional()
    .nullable()
    .or(z.literal("")),
  bankAccountName: z.string().optional().nullable(),
  bankSortCode:    z.string().optional().nullable(),
  notes:           z.string().optional().nullable(),
  contractFileUrl:  z.string().optional().nullable(),
  contractFileName: z.string().optional().nullable(),
  isApproved:      z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const canCreate = await hasGranularPermission("vendor", "list", "create");
    if (!canCreate) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let body: z.infer<typeof CreateSchema>;
    try {
      body = CreateSchema.parse(await req.json());
    } catch (err: any) {
      return NextResponse.json(
        { error: err.errors?.[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const count = await prisma.vendor.count();
    const code  = `VND-${String(count + 1).padStart(4, "0")}`;

    const vendor = await prisma.vendor.create({
      data: {
        ...body,
        entityId: body.entityId || null,
        code,
        createdById: user.id,
      },
      include: {
        entity:    { select: { name: true, code: true } },
        createdBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ vendor }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/vendors]", err);
    return NextResponse.json({ error: "Failed to create vendor" }, { status: 500 });
  }
}
