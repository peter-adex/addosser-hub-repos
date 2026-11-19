import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { parseAdditionalEmails } from "@/lib/payment-v2";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { reminderId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const reminder = await prisma.paymentReminder.findUnique({
      where: { id: params.reminderId },
      include: { vendor: { select: { id: true, name: true } } },
    });

    if (!reminder) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    return NextResponse.json({ reminder });
  } catch (err: any) {
    console.error("[GET /api/payment/reminders/[reminderId]]", err);
    return NextResponse.json({ error: "Failed to load reminder" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { reminderId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const reminder = await prisma.paymentReminder.findUnique({
      where: { id: params.reminderId },
      select: { id: true, createdById: true },
    });

    if (!reminder) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    const isSystem = user.isSystem === true;
    const isOwner  = reminder.createdById === user.id;
    if (!isSystem && !isOwner) {
      return NextResponse.json(
        { error: "You can only deactivate reminders you created" },
        { status: 403 }
      );
    }

    await prisma.paymentReminder.update({
      where: { id: params.reminderId },
      data:  { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DELETE /api/payment/reminders/[reminderId]]", err);
    return NextResponse.json({ error: "Failed to deactivate reminder" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { reminderId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const existing = await prisma.paymentReminder.findUnique({
      where: { id: params.reminderId },
      select: { id: true, createdById: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }
    const isSystem = user.isSystem === true;
    const isOwner = existing.createdById === user.id;
    if (!isSystem && !isOwner) {
      return NextResponse.json(
        { error: "You can only edit reminders you created" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));

    if (body.amount != null && (!Number.isInteger(body.amount) || body.amount <= 0)) {
      return NextResponse.json(
        { error: "Amount must be a positive whole number" },
        { status: 400 },
      );
    }

    const data: Record<string, any> = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.amount !== undefined) {
      data.amount = body.amount != null ? new Prisma.Decimal(body.amount) : null;
    }
    if (body.vendorId !== undefined) data.vendorId = body.vendorId || null;
    if (body.invoiceId !== undefined) data.invoiceId = body.invoiceId || null;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.additionalEmails !== undefined) {
      const { valid, invalid } = parseAdditionalEmails(body.additionalEmails);
      if (invalid.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid email address${invalid.length > 1 ? "es" : ""} in Additional Emails: ${invalid.join(", ")}`,
          },
          { status: 400 },
        );
      }
      data.additionalEmails = valid.length ? valid.join(",") : null;
    }
    if (body.frequency !== undefined) data.frequency = body.frequency;
    if (body.reminderDate !== undefined) {
      const d = new Date(body.reminderDate);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid reminder date/time" }, { status: 400 });
      }
      data.reminderDate = d;
      data.nextSendAt = d;
    }
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const updated = await prisma.paymentReminder.update({
      where: { id: params.reminderId },
      data,
      include: { vendor: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ reminder: updated });
  } catch (err: any) {
    console.error("[PATCH /api/payment/reminders/[reminderId]]", err);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}
