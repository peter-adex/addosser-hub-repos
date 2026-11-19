import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { parseAdditionalEmails } from "@/lib/payment-v2";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;
    const allowedEntityIds = user.isSystem
      ? null
      : (user.allowedEntityIds ?? null);

    const reminders = await prisma.paymentReminder.findMany({
      where: {
        isActive: true,
        ...(allowedEntityIds ? { entityId: { in: allowedEntityIds } } : {}),
      },
      include: {
        vendor: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNo: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { reminderDate: "asc" },
    });

    return NextResponse.json({ reminders });
  } catch (err: any) {
    console.error("[GET /api/payment/reminders]", err);
    return NextResponse.json(
      { error: "Failed to load reminders" },
      { status: 500 },
    );
  }
}

const CreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z
    .number()
    .int("Amount must be a whole number")
    .positive()
    .optional()
    .nullable(),
  vendorId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  reminderDate: z.string().min(1, "Reminder date is required"),
  frequency: z.enum(["ONCE", "WEEKLY", "MONTHLY", "QUARTERLY"]).default("ONCE"),
  notes: z.string().optional().nullable(),
  additionalEmails: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    let body: z.infer<typeof CreateSchema>;
    try {
      const raw = await req.json();
      body = CreateSchema.parse(raw);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.errors?.[0]?.message ?? "Invalid request body" },
        { status: 400 },
      );
    }

    const dueDate = new Date(body.reminderDate);
    if (isNaN(dueDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid reminder date/time" },
        { status: 400 },
      );
    }

    const { valid: additionalEmailsValid, invalid: additionalEmailsInvalid } =
      parseAdditionalEmails(body.additionalEmails);
    if (additionalEmailsInvalid.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid email address${additionalEmailsInvalid.length > 1 ? "es" : ""} in Additional Emails: ${additionalEmailsInvalid.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const reminder = await prisma.paymentReminder.create({
      data: {
        entityId: user.entityId,
        createdById: user.id,
        title: body.title.trim(),
        amount: body.amount != null ? new Prisma.Decimal(body.amount) : null,
        vendorId: body.vendorId ?? null,
        invoiceId: body.invoiceId ?? null,
        reminderDate: dueDate,
        nextSendAt: dueDate,
        frequency: body.frequency,
        notes: body.notes?.trim() || null,
        additionalEmails: additionalEmailsValid.length
          ? additionalEmailsValid.join(",")
          : null,
        isActive: true,
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/payment/reminders]", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      },
      { status: 500 },
    );
  }
}
