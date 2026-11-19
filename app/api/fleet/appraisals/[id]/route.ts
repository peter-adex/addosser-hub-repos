import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  requirePermission,
  successResponse,
  errorResponse,
} from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "appraisals", "canView");
  if (denied) return denied;

  const appraisal = await prisma.driverAppraisal.findUnique({
    where: { id: params.id },
    include: {
      driver: { include: { user: { select: { name: true, email: true } } } },
      supervisor: { select: { name: true, email: true } },
      hrReviewer: { select: { name: true } },
    },
  });

  if (!appraisal) return errorResponse("Appraisal not found", 404);

  return successResponse(appraisal);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "appraisals", "canView");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const { action, hrNotes } = body;

  const appraisal = await prisma.driverAppraisal.findUnique({
    where: { id: params.id },
  });
  if (!appraisal) return errorResponse("Appraisal not found", 404);

  if (action === "submit") {
    const submitDenied = requirePermission(session, "appraisals", "canCreate");
    if (submitDenied) return submitDenied;

    if (appraisal.status !== "draft") {
      return errorResponse("Only draft appraisals can be submitted", 400);
    }

    const updated = await prisma.driverAppraisal.update({
      where: { id: params.id },
      data: { status: "submitted", submittedAt: new Date() },
    });
    return successResponse(updated);
  }

  if (action === "review") {
    const reviewDenied = requirePermission(session, "appraisals", "canApprove");
    if (reviewDenied) return reviewDenied;

    if (appraisal.status !== "submitted") {
      return errorResponse("Only submitted appraisals can be reviewed", 400);
    }

    const updated = await prisma.driverAppraisal.update({
      where: { id: params.id },
      data: {
        status: "reviewed",
        hrReviewedAt: new Date(),
        hrReviewerId: session.user.id,
        hrReviewerName: session.user.name,
        hrNotes: hrNotes ?? null,
      },
    });
    return successResponse(updated);
  }

  if (action === "acknowledge") {
    if (appraisal.status !== "reviewed") {
      return errorResponse("Only reviewed appraisals can be acknowledged", 400);
    }
    const updated = await prisma.driverAppraisal.update({
      where: { id: params.id },
      data: { status: "acknowledged", acknowledgedAt: new Date() },
    });
    return successResponse(updated);
  }

  return errorResponse(`Unknown action: ${action}`, 400);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "appraisals", "canEdit");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));

  const appraisal = await prisma.driverAppraisal.findUnique({
    where: { id: params.id },
  });
  if (!appraisal) return errorResponse("Appraisal not found", 404);
  if (appraisal.status !== "draft") {
    return errorResponse("Only draft appraisals can be edited", 400);
  }

  const updated = await prisma.driverAppraisal.update({
    where: { id: params.id },
    data: {
      scoresJson: JSON.stringify(body.scores ?? {}),
      overallScore: body.overallScore ?? appraisal.overallScore,
      grade: body.grade ?? appraisal.grade,
      supervisorComments:
        body.supervisorComments ?? appraisal.supervisorComments,
    },
  });
  return successResponse(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(session, "appraisals", "canDelete");
  if (denied) return denied;

  const appraisal = await prisma.driverAppraisal.findUnique({
    where: { id: params.id },
  });
  if (!appraisal) return errorResponse("Appraisal not found", 404);
  if (appraisal.status !== "draft") {
    return errorResponse("Only draft appraisals can be deleted", 400);
  }

  await prisma.driverAppraisal.delete({ where: { id: params.id } });
  return successResponse({ deleted: true });
}
