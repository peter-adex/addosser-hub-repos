import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGranularPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import BudgetEditForm from "@/components/budgeting/BudgetEditForm";

export const metadata: Metadata = { title: "Edit Budget" };

export default async function BudgetEditPage({ params }: { params: { id: string } }) {
  await requireGranularPermission("budgeting", "budgets", "edit");

  const budget = await prisma.budget.findUnique({
    where: { id: params.id },
    include: {
      monthlyLines: { orderBy: { month: "asc" } },
      entityGL: { include: { glAccount: true, entity: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!budget) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/budgeting" className="hover:text-foreground">Budgeting</Link>
        <span>/</span>
        <Link href={`/budgeting/${params.id}`} className="hover:text-foreground">{budget.entityGL.glAccount.name}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Edit</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Edit Budget</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {budget.entityGL.entity.name} · {budget.entityGL.glAccount.code} — {budget.entityGL.glAccount.name} · FY {budget.financialYear}
        </p>
      </div>

      {budget.status === "APPROVED" ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-bold text-foreground mb-2">Budget is Approved — Locked</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Approved budgets cannot be edited. Contact a Finance Manager to request a revision.
          </p>
          <Link href={`/budgeting/${params.id}`}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent">
            ← Back to Budget
          </Link>
        </div>
      ) : (
        <BudgetEditForm budget={budget as any} />
      )}
    </div>
  );
}
