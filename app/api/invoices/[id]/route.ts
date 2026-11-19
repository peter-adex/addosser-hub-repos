import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { hasGranularPermission } from "@/lib/permissions";
import { z } from "zod";
import { InvoiceCategoryType } from "@prisma/client";
import { checkOpexBudget, lockBudgetForUpdate } from "@/lib/budget-validation";

export const dynamic = "force-dynamic";

const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
});

const InvoiceUpdateSchema = z.object({
  entityId: z.string().cuid(),
  budgetEntityId: z.string().cuid().optional(),
  assetId: z.string().cuid().optional(),
  branchId: z.string().cuid().optional(),
  vendorId: z.string().cuid().optional(),
  vendorName: z.string().optional().default(""),
  vendorEmail: z.string().email().optional().or(z.literal("")),
  glAccountCode: z.string().min(1, "GL Account is required"),
  glAccountId: z.string().cuid().optional(),
  vatRate: z.number().min(0).max(1).default(0.075),
  whtRate: z.number().min(0).max(1).default(0.02),
  lineItems: z
    .array(LineItemSchema)
    .min(1, "At least one line item is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),

  invoiceType: z
    .nativeEnum(InvoiceCategoryType)
    .default(InvoiceCategoryType.GENERAL_EXPENSE),

  attachments: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") return undefined;
    if (Array.isArray(val)) return val.length ? JSON.stringify(val) : undefined;
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed))
          return parsed.length ? JSON.stringify(parsed) : undefined;
        return val;
      } catch {
        return val;
      }
    }
    return undefined;
  }, z.string().optional()),
  exceptionalJustification: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canEdit = await hasGranularPermission("invoice", "invoices", "edit");
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    const isGLCorrection =
      body.glAccountCode && body.glAccountId && !body.lineItems;

    if (isGLCorrection) {
      const updatedInvoice = await prisma.invoice.update({
        where: {
          id: params.id,
        },
        data: {
          glAccountCode: body.glAccountCode,
          glAccountId: body.glAccountId,

          budgetEntityId: body.budgetEntityId,

          isBudgetExceeded: body.isBudgetExceeded ?? false,

          isExceptionalApproval: body.isExceptionalApproval ?? false,
        },

        include: {
          glAccount: true,

          budgetEntity: true,
        },
      });

      await logAudit({
        userId: (session.user as any).id,
        action: "EDIT_INVOICE_GL",
        module: "invoice",
        entityId: updatedInvoice.entityId,
        resourceId: updatedInvoice.id,
        resourceType: "Invoice",
      });

      return NextResponse.json({
        success: true,
        data: updatedInvoice,
      });
    }

    const parsed = InvoiceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.entries(fieldErrors).find(([, v]) => v?.length);
      const message = firstError
        ? `${firstError[0]}: ${firstError[1]?.[0]}`
        : "Validation failed";

      return NextResponse.json(
        { error: message, details: fieldErrors },
        { status: 400 },
      );
    }

    const {
      entityId,
      budgetEntityId,
      assetId,
      branchId,
      vendorId,
      vendorName,
      vendorEmail,
      glAccountCode,
      glAccountId,
      vatRate,
      whtRate,
      lineItems,
      description,
      dueDate,
      invoiceType,
      attachments,
      exceptionalJustification,
    } = parsed.data;

    const computedItems = lineItems.map((item, i) => ({
      description: item.description,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: parseFloat((item.quantity * item.unitCost).toFixed(2)),
      sortOrder: i,
    }));

    const subtotal = parseFloat(
      computedItems.reduce((s, i) => s + i.totalCost, 0).toFixed(2),
    );
    const vatAmount = parseFloat((subtotal * vatRate).toFixed(2));
    const whtAmount = parseFloat((subtotal * whtRate).toFixed(2));
    const totalAmount = parseFloat((subtotal + vatAmount).toFixed(2));
    const amountPayable = parseFloat((subtotal - whtAmount).toFixed(2));

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const existingGLAccount = await tx.gLAccount.findUnique({ where: { code: glAccountCode } });
      if (existingGLAccount) {
        await lockBudgetForUpdate(tx, { entityId, glAccountCode, financialYear: currentYear });
      }
      const budgetCheck = await checkOpexBudget({
        entityId,
        glAccountCode,
        amountPayable: totalAmount,
        tx,
      });
      const isBudgetExceeded = budgetCheck.exceeded;
      const exceedanceAmount = budgetCheck.exceeded ? budgetCheck.exceedanceAmount : null;
      const isExceptionalApproval = budgetCheck.exceeded;

      await tx.invoiceLineItem.deleteMany({
        where: { invoiceId: params.id },
      });

      return await tx.invoice.update({
        where: { id: params.id },
        data: {
          entityId,
          budgetEntityId: budgetEntityId ?? null,
          assetId: assetId ?? null,
          branchId: branchId ?? null,
          vendorId: vendorId ?? null,
          vendorName,
          vendorEmail: vendorEmail || null,
          glAccountCode,
          glAccountId: glAccountId ?? null,
          invoiceType,
          subtotal,
          vatRate,
          vatAmount,
          whtRate,
          whtAmount,
          totalAmount,
          amountPayable,
          isBudgetExceeded,
          exceedanceAmount: exceedanceAmount ?? undefined,
          isExceptionalApproval,
          exceptionalJustification: isExceptionalApproval
            ? (exceptionalJustification ?? null)
            : null,
          budgetYear: budgetCheck.hasBudget ? budgetCheck.financialYear : null,
          budgetMonth: budgetCheck.hasBudget ? budgetCheck.currentMonth : null,
          annualBudgetAmount: budgetCheck.hasBudget ? budgetCheck.annualBudget : null,
          monthlyBudgetAmount: budgetCheck.hasBudget ? budgetCheck.monthlyBudget : null,
          monthlyExpensedAmount: budgetCheck.hasBudget ? budgetCheck.monthlyCommitted : null,
          monthlyAvailableAmount: budgetCheck.hasBudget ? budgetCheck.monthlyAvailable : null,
          description: description ?? null,
          dueDate: dueDate ? new Date(dueDate) : null,
          attachments: attachments ?? null,
          lineItems: { create: computedItems },
        },
        include: {
          lineItems: true,
          asset: true,
        },
      });
    }, { timeout: 15000 });

    await logAudit({
      userId: (session.user as any).id,
      action: "EDIT_INVOICE",
      module: "invoice",
      entityId: updatedInvoice.entityId,
      resourceId: updatedInvoice.id,
      resourceType: "Invoice",
    });

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
    });
  } catch (error: any) {
    console.error("[API_INVOICE_PATCH_FATAL_ERROR]", error);
    return NextResponse.json(
      { error: error.message ?? "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canDelete = await hasGranularPermission("invoice", "invoices", "delete");
  if (!canDelete)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only DRAFT invoices can be deleted" },
      { status: 409 },
    );
  }

  await prisma.invoice.delete({ where: { id: params.id } });

  await logAudit({
    userId: (session.user as any).id,
    action: "INVOICE_DELETED",
    module: "invoice",
    resourceId: params.id,
    resourceType: "Invoice",
  });

  return NextResponse.json({ success: true });
}
