import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  requirePermission,
  successResponse,
  errorResponse,
  parseBody,
  paginatedResponse,
  getPagination,
} from "@/lib/api-helpers";
import { z } from "zod";

const kpiSchema = z.object({
  key: z.string(),
  description: z.string(),
  maxWeight: z.number().int().positive(),
  achievement: z.number().min(0).nullable(),
});

const kpaSchema = z.object({
  key: z.string(),
  label: z.string(),
  sectionWeight: z.number(),
  kpis: z.array(kpiSchema),
});

const personalAttrSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  rating: z
    .union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
    .nullable(),
});

const createAppraisalSchema = z.object({
  driverId: z.string().cuid("Invalid driver ID"),
  period: z.string().min(3, "Period is required (e.g. March 2026)"),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2020),
  personalAttributes: z.array(personalAttrSchema),
  kpas: z.array(kpaSchema),
  supervisorComments: z.string().optional(),
  section1Score: z.number(),
  section1Contribution: z.number(),
  vehicleMaintScore: z.number(),
  safetyScore: z.number(),
  processScore: z.number(),
  section2Contribution: z.number(),
  overallScore: z.number(),
  grade: z.string(),
});

export async function GET(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "appraisals", "canView");
  if (denied) return denied;

  const { skip, take, page, limit } = getPagination(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "";

  const where: Record<string, any> = {};

  const canApprove =
    session.user.role === "admin" ||
    session.user.fleetPagePermissions?.get("appraisals")?.has("approve") === true;

  if (!canApprove) {
    where.status = { in: ["submitted", "reviewed", "acknowledged"] };
  } else if (status) {
    where.status = status;
  }

  if (search) where.driverName = { contains: search };

  const [appraisals, total] = await prisma.$transaction([
    prisma.driverAppraisal.findMany({
      where,
      skip,
      take,
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      include: {
        driver: { include: { user: { select: { name: true, email: true } } } },
      },
    }),
    prisma.driverAppraisal.count({ where }),
  ]);

  return paginatedResponse(appraisals, total, page, limit);
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "appraisals", "canCreate");
  if (denied) return denied;

  const { data, error } = await parseBody(request, createAppraisalSchema);
  if (error) return error;

  const driver = await prisma.driver.findUnique({
    where: { id: data.driverId },
    include: { user: { select: { name: true } } },
  });
  if (!driver) return errorResponse("Driver not found", 404);

  const duplicate = await prisma.driverAppraisal.findFirst({
    where: {
      driverId: data.driverId,
      periodMonth: data.periodMonth,
      periodYear: data.periodYear,
    },
  });
  if (duplicate) {
    return errorResponse(
      `An appraisal for ${driver.user.name} for ${data.period} already exists (Status: ${duplicate.status})`,
      409,
    );
  }

  try {
    const appraisal = await prisma.driverAppraisal.create({
      data: {
        driverId: data.driverId,
        driverName: driver.user.name,
        supervisorId: session.user.id,
        supervisorName: session.user.name,
        entityId: session.user.entityId ?? "",
        period: data.period,
        periodMonth: data.periodMonth,
        periodYear: data.periodYear,
        status: "draft",
        supervisorComments: data.supervisorComments,
        scoresJson: JSON.stringify({
          personalAttributes: data.personalAttributes,
          kpas: data.kpas,
          section1Score: data.section1Score,
          section1Contribution: data.section1Contribution,
          vehicleMaintScore: data.vehicleMaintScore,
          safetyScore: data.safetyScore,
          processScore: data.processScore,
          section2Contribution: data.section2Contribution,
          overallScore: data.overallScore,
          grade: data.grade,
        }),
        overallScore: data.overallScore,
        grade: data.grade,
      },
    });
    return successResponse(appraisal, 201);
  } catch (err) {
    console.error("[POST /api/appraisals]", err);
    return errorResponse("Failed to save appraisal", 500);
  }
}
