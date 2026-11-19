import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
<<<<<<< HEAD
import { hasGranularPermission } from "@/lib/permissions";
import { checkOpexBudget, lockBudgetForUpdate } from "@/lib/budget-validation";
import { checkFuelEntitlementForLines } from "@/lib/fuel-entitlement-validation";
import { postInvoiceDebit } from "@/lib/gl-transactions";
import { z } from "zod";

export const dynamic = "force-dynamic";

class InvoiceValidationError extends Error {}

const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  vehicleId: z.string().cuid().optional(),
});

const InvoiceSchema = z.object({
  entityId: z.string().cuid(),
  branchId: z.string().cuid().optional(),
  vendorId: z.string().cuid().optional(),
  vendorName: z.string().optional().default(""),
  vendorEmail: z.string().email().optional().or(z.literal("")),
  vendorIsOneTime: z.boolean().optional().default(false),
  oneTimeVendorPhone: z.string().optional(),
  oneTimeVendorBankName: z.string().optional(),
  oneTimeVendorBankAccountNo: z.string().optional(),
  oneTimeVendorBankAccountName: z.string().optional(),
  oneTimeVendorReason: z.string().optional(),
  glAccountCode: z.string().min(1, "GL Account is required"),
  glAccountId: z.string().cuid().optional(),
  vatRate: z.number().min(0).max(1).default(0.075),
  whtRate: z.number().min(0).max(1).default(0.02),
  lineItems: z
    .array(LineItemSchema)
    .min(1, "At least one line item is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  budgetEntityId: z.string().cuid().optional(),
  assetId: z.string().cuid().optional(),
  invoiceType: z
    .enum(["GENERAL_EXPENSE", "ASSET_RELATED", "ASSET_PURCHASE", "FLEET_FUEL"])
    .optional(),
  vehicleId: z.string().cuid().optional(),
  fuelLitres: z.number().positive().optional(),
  fuelType: z.enum(["litres", "naira"]).optional(),
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
  approverSelections: z
    .array(
      z.object({
        stepNumber: z.number().int().min(1),
        userId: z.string().min(1),
      }),
    )
    .min(1, "At least one approver must be selected"),
=======
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const InvoiceSchema = z.object({
  entityId: z.string().cuid(),
  invoiceNo: z.string().min(2),
  vendorName: z.string().min(2),
  vendorEmail: z.string().email().optional(),
  description: z.string().optional(),
  amount: z.number().positive(),
  tax: z.number().min(0).optional(),
  glAccountCode: z.string().optional(),
  dueDate: z.string().optional(),
  attachments: z.array(z.string()).optional(),
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
<<<<<<< HEAD
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canView = await hasGranularPermission("invoice", "invoices", "view");
  if (!canView)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = session.user as any;
  const { searchParams } = new URL(req.url);
  const entityId =
    searchParams.get("entityId") ?? (user.isSystem ? null : user.entityId);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
=======
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasPermission("invoice", "canView");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const status = searchParams.get("status");
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

  const where: any = {
    ...(entityId ? { entityId } : {}),
    ...(status ? { status } : {}),
<<<<<<< HEAD
    ...(q
      ? {
          OR: [{ invoiceNo: { contains: q } }, { vendorName: { contains: q } }],
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
<<<<<<< HEAD
      include: {
        entity: { select: { name: true, code: true } },
        vendor: { select: { name: true, code: true } },
        asset: true,
        submittedBy: { select: { name: true, email: true, id: true } },
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
=======
      include: { entity: { select: { name: true, code: true } }, submittedBy: { select: { name: true } } },
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.count({ where }),
  ]);

<<<<<<< HEAD
  return NextResponse.json({
    success: true,
    data: invoices,
    total,
    page,
    pageSize,
  });
=======
  return NextResponse.json({ success: true, data: invoices, total, page, pageSize });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
<<<<<<< HEAD
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canCreate = await hasGranularPermission("invoice", "invoices", "create");
  if (!canCreate)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = (session.user as any).id;
  const body = await req.json();
  const parsed = InvoiceSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors).find(([, v]) => v?.length);
    const message = firstError
      ? `${firstError[0]}: ${firstError[1]?.[0]}`
      : (parsed.error.issues[0]?.message ?? "Validation failed");
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
    vendorIsOneTime,
    oneTimeVendorPhone,
    oneTimeVendorBankName,
    oneTimeVendorBankAccountNo,
    oneTimeVendorBankAccountName,
    oneTimeVendorReason,
    glAccountCode,
    glAccountId,
    vatRate,
    whtRate,
    lineItems,
    description,
    dueDate,
    attachments,
    exceptionalJustification,
    approverSelections,
    invoiceType,
  } = parsed.data;

  const isFuelRequest = invoiceType === "FLEET_FUEL";

  let effectiveVatRate = vatRate;
  let effectiveWhtRate = whtRate;
  let fuelLineVehicleIds: string[] = [];

  if (isFuelRequest) {
    effectiveVatRate = 0;
    effectiveWhtRate = 0;

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "Add at least one vehicle to the fuel payment request" },
        { status: 400 },
      );
    }

    fuelLineVehicleIds = lineItems.map((li) => li.vehicleId).filter((v): v is string => !!v);
    if (fuelLineVehicleIds.length !== lineItems.length) {
      return NextResponse.json(
        { error: "Every line must have a vehicle selected" },
        { status: 400 },
      );
    }
    if (new Set(fuelLineVehicleIds).size !== fuelLineVehicleIds.length) {
      return NextResponse.json(
        { error: "The same vehicle appears more than once — each vehicle can only have one line" },
        { status: 400 },
      );
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { id: { in: fuelLineVehicleIds } },
      select: { id: true, entityId: true, plateNumber: true },
    });
    const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));
    for (const vId of fuelLineVehicleIds) {
      const v = vehiclesById.get(vId);
      if (!v) {
        return NextResponse.json({ error: "One of the selected vehicles was not found" }, { status: 404 });
      }
      if (v.entityId && v.entityId !== entityId) {
        return NextResponse.json(
          { error: `${v.plateNumber} does not belong to the selected entity` },
          { status: 422 },
        );
      }
    }
  }

  if (vendorIsOneTime) {
    if (!vendorName.trim()) {
      return NextResponse.json(
        { error: "Vendor/payee name is required" },
        { status: 400 },
      );
    }
    if (!oneTimeVendorReason?.trim()) {
      return NextResponse.json(
        { error: "A reason is required when paying a one-time vendor" },
        { status: 400 },
      );
    }
    if (invoiceType === "FLEET_FUEL") {
      if (!oneTimeVendorBankName?.trim()) {
        return NextResponse.json({ error: "Bank name is required for a one-time payee" }, { status: 400 });
      }
      if (!oneTimeVendorBankAccountName?.trim()) {
        return NextResponse.json({ error: "Account name is required for a one-time payee" }, { status: 400 });
      }
      if (!/^\d{9}$/.test((oneTimeVendorBankAccountNo ?? "").trim())) {
        return NextResponse.json(
          { error: "Account number must be exactly 9 digits (numbers only)" },
          { status: 400 },
        );
      }
    }
  } else if (!vendorId && !vendorName.trim()) {
    return NextResponse.json({ error: "Vendor is required" }, { status: 400 });
  }

  const computedItems = lineItems.map((item, i) => ({
    ...item,
    totalCost: parseFloat((item.quantity * item.unitCost).toFixed(2)),
    sortOrder: i,
  }));
  const subtotal = parseFloat(
    computedItems.reduce((s, i) => s + i.totalCost, 0).toFixed(2),
  );
  const vatAmount = parseFloat((subtotal * effectiveVatRate).toFixed(2));
  const whtAmount = parseFloat((subtotal * effectiveWhtRate).toFixed(2));
  const totalAmount = parseFloat((subtotal + vatAmount).toFixed(2));
  const amountPayable = parseFloat((subtotal - whtAmount).toFixed(2));

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const glAccountRecord = await prisma.gLAccount.findUnique({ where: { code: glAccountCode } });
  if (!glAccountRecord || !glAccountRecord.isActive) {
    return NextResponse.json({ error: `GL Account "${glAccountCode}" does not exist or is inactive` }, { status: 422 });
  }
  const entityGLLink = await prisma.entityGLAccount.findFirst({
    where: { entityId, glAccountId: glAccountRecord.id, isActive: true },
  });
  if (!entityGLLink) {
    return NextResponse.json({ error: `GL Account "${glAccountCode}" is not enabled for this entity` }, { status: 422 });
  }

  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  const lastInv = await prisma.invoice.findFirst({
    orderBy: { createdAt: "desc" },
  });
  const seq = lastInv
    ? parseInt(lastInv.invoiceNo.split("-").pop() ?? "0") + 1
    : 1;
  const invoiceNo = `${entity?.code ?? "INV"}-${currentYear}-${String(seq).padStart(5, "0")}`;

  let invoice;
  try {
    invoice = await prisma.$transaction(async (tx) => {
      if (glAccountRecord && entityGLLink) {
        await lockBudgetForUpdate(tx, { entityId, glAccountCode, financialYear: currentYear });
      }
      const budgetCheck = await checkOpexBudget({
        entityId,
        glAccountCode,
        amountPayable: totalAmount,
        tx,
      });
      let fuelCheck: Awaited<ReturnType<typeof checkFuelEntitlementForLines>> | null = null;
      if (isFuelRequest) {
        const entitlements = await tx.vehicleFuelEntitlement.findMany({
          where: { vehicleId: { in: fuelLineVehicleIds } },
          select: { vehicleId: true, type: true },
        });
        const basisByVehicle = new Map(entitlements.map((e) => [e.vehicleId, e.type as "litres" | "naira"]));
        fuelCheck = await checkFuelEntitlementForLines(
          computedItems
            .filter((li) => li.vehicleId)
            .map((li) => {
              const basis = basisByVehicle.get(li.vehicleId!) ?? "litres";
              return {
                vehicleId: li.vehicleId!,
                fuelType: basis,
                requestedAmount: basis === "naira" ? li.totalCost : li.quantity,
              };
            }),
          { tx },
        );
      }

      const isBudgetExceeded = budgetCheck.exceeded || !!fuelCheck?.anyExceeded;
      const exceedanceAmount = isBudgetExceeded
        ? (budgetCheck.exceeded ? budgetCheck.exceedanceAmount : 0) +
          (fuelCheck?.anyExceeded ? fuelCheck.totalExceedanceAmount : 0)
        : null;
      const isExceptionalApproval = isBudgetExceeded;

      const workflows = await tx.approvalWorkflow.findMany({
        where: { entityId, module: "invoice", isActive: true },
        include: {
          steps: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { stepNumber: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const allSteps = workflows.flatMap((w) => w.steps);

      if (!workflows.length || !allSteps.length) {
        throw new InvoiceValidationError(
          "No active Invoice Approval Workflow is configured for this entity. Contact an Administrator.",
        );
      }

      const eligibleByStep = new Map<number, typeof allSteps>();
      for (const step of allSteps) {
        if (!step.userId) continue;
        if (isBudgetExceeded && !step.isExceptionalApprover) continue;
        const list = eligibleByStep.get(step.stepNumber) ?? [];
        list.push(step);
        eligibleByStep.set(step.stepNumber, list);
      }
      const requiredStepNumbers = Array.from(eligibleByStep.keys()).sort((a, b) => a - b);

      if (isBudgetExceeded && requiredStepNumbers.length === 0) {
        throw new InvoiceValidationError(
          "This invoice exceeds the available GL budget for the current month, but no approver in this workflow has Exceptional Approval Workflow permission. Ask an Administrator to configure one.",
        );
      }

      const submittedStepNumbers = approverSelections.map((s) => s.stepNumber).sort((a, b) => a - b);
      const sequenceValid =
        submittedStepNumbers.length === requiredStepNumbers.length &&
        submittedStepNumbers.every((n, i) => n === requiredStepNumbers[i]);
      if (!sequenceValid) {
        throw new InvoiceValidationError(
          isBudgetExceeded
            ? "Budget availability changed while this invoice was being submitted, and it now requires exceptional approval. Please review the approver selection and resubmit."
            : "The selected approvers do not match the configured approval sequence. Please select exactly one approver for each required step.",
        );
      }

      const selectionRows: {
        stepNumber: number;
        userId: string;
        approvalLimitAmount: number | null;
        isExceptionalApprover: boolean;
      }[] = [];
      for (const sel of approverSelections) {
        const eligible = eligibleByStep.get(sel.stepNumber) ?? [];
        const match = eligible.find((e) => e.userId === sel.userId);
        if (!match) {
          throw new InvoiceValidationError(
            `The selected approver for step ${sel.stepNumber} is not eligible for this entity/workflow.`,
          );
        }
        selectionRows.push({
          stepNumber: sel.stepNumber,
          userId: sel.userId,
          approvalLimitAmount: match.approvalLimitAmount ? Number(match.approvalLimitAmount) : null,
          isExceptionalApprover: match.isExceptionalApprover,
        });
      }

      const created = await tx.invoice.create({
        data: {
          invoiceNo,
          entityId,
          budgetEntityId: budgetEntityId ?? null,
          assetId: assetId ?? null,
          branchId: branchId ?? null,
          vendorId: vendorId ?? null,
          vendorName,
          vendorEmail: vendorEmail || null,
          vendorIsOneTime: vendorIsOneTime ?? false,
          oneTimeVendorPhone: vendorIsOneTime ? (oneTimeVendorPhone || null) : null,
          oneTimeVendorBankName: vendorIsOneTime ? (oneTimeVendorBankName || null) : null,
          oneTimeVendorBankAccountNo: vendorIsOneTime ? (oneTimeVendorBankAccountNo || null) : null,
          oneTimeVendorBankAccountName: vendorIsOneTime ? (oneTimeVendorBankAccountName || null) : null,
          oneTimeVendorReason: vendorIsOneTime ? (oneTimeVendorReason || null) : null,
          glAccountCode,
          glAccountId: glAccountRecord.id,
          vehicleId: null,
          fuelType: null,
          fuelLitres: null,
          subtotal,
          vatRate: effectiveVatRate,
          vatAmount,
          whtRate: effectiveWhtRate,
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
          status: "DRAFT",
          submittedById: userId,
          lineItems: { create: computedItems },
          approvalSelections: { create: selectionRows },
        },
        include: {
          lineItems: true,
          asset: true,
          entity: { select: { name: true, code: true } },
          approvalSelections: { include: { user: { select: { name: true, email: true } } } },
        },
      });

      if (budgetCheck.hasBudget && budgetCheck.budgetId) {
        await tx.actualLine.create({
          data: {
            budgetId: budgetCheck.budgetId,
            month: currentMonth,
            amount: amountPayable,
            description: `Invoice ${invoiceNo} — ${vendorName}`,
            invoiceId: created.id,
          },
        });
      }

      return created;
    }, { timeout: 15000 });
  } catch (err) {
    if (err instanceof InvoiceValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[InvoicePOST] Transaction failed:", err);
    return NextResponse.json(
      { error: "Failed to create invoice. Please try again." },
      { status: 500 },
    );
  }

  const isBudgetExceeded = invoice.isBudgetExceeded;
  const exceedanceAmount = invoice.exceedanceAmount;
  const isExceptionalApproval = invoice.isExceptionalApproval;

  try {
    await postInvoiceDebit({
      entityId,
      glAccountId: glAccountRecord.id,
      amount: amountPayable,
      invoiceId: invoice.id,
      invoiceNo,
      vendorName,
      createdById: userId,
      assetId: assetId ?? null,
    });
  } catch (err) {
    console.error("[InvoicePOST] Failed to post GLTransaction debit:", err);
  }

  await logAudit({
    userId,
    action: "INVOICE_CREATED",
    module: "invoice",
    entityId,
    resourceId: invoice.id,
    resourceType: "Invoice",
    afterData: JSON.stringify({
      invoiceNo,
      subtotal,
      vatAmount,
      whtAmount,
      totalAmount,
      amountPayable,
      isBudgetExceeded,
    }),
  });

  return NextResponse.json(
    {
      success: true,
      data: invoice,
      budgetWarning: isBudgetExceeded
        ? {
            exceeded: true,
            exceedance: exceedanceAmount,
            exceptional: isExceptionalApproval,
          }
        : null,
    },
    { status: 201 },
  );
=======
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canCreate = await hasPermission("invoice", "canCreate");
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = InvoiceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { attachments, dueDate, amount, tax, ...rest } = parsed.data;
  const totalAmount = amount + (tax ?? 0);

  const invoice = await prisma.invoice.create({
    data: {
      ...rest,
      amount,
      tax,
      totalAmount,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      attachments: attachments ? JSON.stringify(attachments) : undefined,
      submittedById: (session.user as any).id,
    },
  });

  await logAudit({ userId: (session.user as any).id, action: "INVOICE_CREATED", module: "invoice", entityId: invoice.entityId, resourceId: invoice.id });

  return NextResponse.json({ success: true, data: invoice }, { status: 201 });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
