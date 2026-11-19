import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  getRequiredSession,
  successResponse,
  errorResponse,
  parseBody,
  paginatedResponse,
  getPagination,
  requirePermission,
} from "@/lib/api-helpers";

import { z } from "zod";

const createEntitySchema = z.object({
  name: z.string().min(2, "Entity name is required"),

  shortName: z.string().optional(),

  code: z.string().min(2).max(10, "Code max 10 chars").toUpperCase(),

  type: z.enum(["Bank", "Finance", "Investment", "Properties"]),

  annualMaintenanceBudgetNgn: z.number().min(0).default(0),

  locations: z
    .array(
      z.object({
        name: z.string().min(2),
        address: z.string().min(5),
        city: z.string().min(2),
        isHeadOffice: z.boolean().default(false),
      }),
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  const session = await getRequiredSession();

  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  const { skip, take, page, limit } = getPagination(request);

  const url = new URL(request.url);

  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const search = url.searchParams.get("search") ?? "";

  const where: Record<string, any> = {};

  if (!includeInactive) {
    where.isActive = true;
  }

  if (search) {
    where.name = {
      contains: search,
    };
  }

  const [entities, total] = await prisma.$transaction([
    prisma.entity.findMany({
      where,
      skip,
      take,
      orderBy: {
        name: "asc",
      },
      include: {
        locations: {
          orderBy: {
            isHeadOffice: "desc",
          },
        },
      },
    }),

    prisma.entity.count({
      where,
    }),
  ]);

  return paginatedResponse(entities, total, page, limit);
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession();

  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  const denied = requirePermission(session, "entities", "canCreate");

  if (denied) {
    return denied;
  }

  const { data, error } = await parseBody(request, createEntitySchema);

  if (error) {
    return error;
  }

  const existing = await prisma.entity.findUnique({
    where: {
      code: data.code,
    },
  });

  if (existing) {
    return errorResponse(`Entity code '${data.code}' is already in use`, 409);
  }

  try {
    const entity = await prisma.entity.create({
      data: {
        name: data.name.trim(),

        shortName: data.shortName,

        code: data.code.toUpperCase(),

        type: data.type,

        annualMaintenanceBudgetNgn: data.annualMaintenanceBudgetNgn,

        status: "active",

        locations: data.locations
          ? {
              create: data.locations.map((loc) => ({
                name: loc.name,
                address: loc.address,
                city: loc.city,
                isHeadOffice: loc.isHeadOffice,
              })),
            }
          : undefined,
      },

      include: {
        locations: true,
      },
    });

    return successResponse(entity, 201);
  } catch (err) {
    console.error("[POST /api/entities]", err);

    return errorResponse("Failed to create entity", 500);
  }
}
