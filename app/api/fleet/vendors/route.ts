import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  requireRole,
  successResponse,
  errorResponse,
  parseBody,
  paginatedResponse,
  getPagination,
  requirePermission,
} from "@/lib/api-helpers";
import { z } from "zod";

const vendorContactSchema = z.object({
  name: z.string().min(2, "Contact name is required"),
  phone: z.string().min(7, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  designation: z.string().optional(),
});

const createVendorSchema = z.object({
  name: z.string().min(2, "Vendor name is required"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  country: z.string().default("Nigeria"),
  classifications: z
    .array(
      z.enum([
        "service_repair",
        "service_only",
        "repair_only",
        "fuel",
        "parts_accessories",
        "vehicle_purchase",
      ]),
    )
    .min(1, "Select at least one classification"),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  notes: z.string().optional(),
  contacts: z
    .array(vendorContactSchema)
    .min(1, "At least one contact is required"),
});

export async function GET(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "vendors", "canView");
  if (denied) return denied;

  const { skip, take, page, limit } = getPagination(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "";

  const where: Record<string, any> = {};
  if (status === "active") where.isActive = true;
  else if (status === "inactive") where.isActive = false;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { city: { contains: search } },
      { state: { contains: search } },
    ];
  }

  const [vendors, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: { contacts: true },
    }),
    prisma.vendor.count({ where }),
  ]);

  return paginatedResponse(vendors, total, page, limit);
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "vendors", "canCreate");
  if (denied) return denied;

  const { data, error } = await parseBody(request, createVendorSchema);
  if (error) return error;

  try {
    const vendor = await prisma.vendor.create({
      data: {
        name: data.name.trim(),
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        classifications: JSON.stringify(data.classifications),
        bankName: data.bankName,
        bankAccountNo: data.accountNumber,
        bankAccountName: data.accountName,
        notes: data.notes,
        createdById: session.user.id,
        isActive: true,
        contacts: {
          create: data.contacts.map((c) => ({
            name: c.name.trim(),
            phone: c.phone.trim(),
            email: c.email || null,
            designation: c.designation,
          })),
        },
      },
      include: { contacts: true },
    });

    return successResponse(vendor, 201);
  } catch (err) {
    console.error("[POST /api/vendors]", err);
    return errorResponse("Failed to create vendor", 500);
  }
}
