import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { hasGranularPermission } from "@/lib/permissions";
import { z } from "zod";
import { ACCOUNT_NUMBER_REGEX, ACCOUNT_NUMBER_ERROR_MESSAGE } from "@/lib/vendor-validation";

export const dynamic = "force-dynamic";

const UpdateVendorSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  taxId: z.string().optional(),
  rcNumber: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z
    .string()
    .regex(ACCOUNT_NUMBER_REGEX, ACCOUNT_NUMBER_ERROR_MESSAGE)
    .optional()
    .or(z.literal("")),
  bankAccountName: z.string().optional(),
  bankSortCode: z.string().optional(),
  contractFileUrl: z.string().optional(),
  contractFileName: z.string().optional(),
  isApproved: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

async function canView() {
  return hasGranularPermission("vendor", "list", "view");
}
async function canEdit() {
  return hasGranularPermission("vendor", "list", "edit");
}
async function canDelete() {
  return hasGranularPermission("vendor", "list", "delete");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { vendorId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canView()))
    return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const vendor = await prisma.vendor.findUnique({
    where: { id: params.vendorId },
    include: {
      entity: { select: { name: true, code: true } },
      createdBy: { select: { name: true, email: true } },
      invoices: {
        select: { id: true, invoiceNo: true, status: true, amountPayable: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { invoices: true } },
    },
  });
  if (!vendor)
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: vendor });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { vendorId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  if (!(await canEdit()))
    return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const body = await req.json();
  const parsed = UpdateVendorSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(fieldErrors).find((v) => v?.length)?.[0];
    return NextResponse.json(
      { error: firstError ?? "Validation failed" },
      { status: 400 },
    );
  }

  const vendor = await prisma.vendor.update({
    where: { id: params.vendorId },
    data: parsed.data,
  });

  await logAudit({
    userId: user.id,
    action: "VENDOR_UPDATED",
    module: "invoice",
    resourceId: params.vendorId,
    resourceType: "Vendor",
    afterData: JSON.stringify(parsed.data),
  });

  return NextResponse.json({ success: true, data: vendor });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { vendorId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  if (!(await canDelete()))
    return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const invoiceCount = await prisma.invoice.count({ where: { vendorId: params.vendorId } });

  if (invoiceCount > 0) {
    await prisma.vendor.update({ where: { id: params.vendorId }, data: { isActive: false } });
    return NextResponse.json({
      success: true,
      message: "Vendor deactivated (has invoice history)",
    });
  }

  await prisma.vendor.delete({ where: { id: params.vendorId } });

  await logAudit({
    userId: user.id,
    action: "VENDOR_DELETED",
    module: "invoice",
    resourceId: params.vendorId,
    resourceType: "Vendor",
  });

  return NextResponse.json({ success: true });
}
