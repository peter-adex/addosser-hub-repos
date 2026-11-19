import { Metadata }                       from "next";
import Link                               from "next/link";
import { notFound, redirect }             from "next/navigation";
import { requireAuth, hasGranularPermission } from "@/lib/permissions";
import { prisma }                         from "@/lib/prisma";
import { formatCompact }                  from "@/lib/utils";
import { Badge }                          from "@/components/shared/Badge";
import AssetPreviewClient                 from "@/components/assets/AssetPreviewClient";

export const metadata: Metadata = { title: "Asset Preview — Review & Submit" };

export default async function AssetPreviewPage({ params }: { params: { id: string } }) {
  const canCreate = await hasGranularPermission("assets", "register", "create");
  const canEdit = await hasGranularPermission("assets", "edit", "edit");
  if (!canCreate && !canEdit) redirect("/unauthorized");
  const user = await requireAuth();

  const asset = await prisma.asset.findUnique({
    where:   { id: params.id },
    include: {
      entity:         { select: { id: true, name: true, code: true } },
      branch:         { select: { name: true, code: true } },
      classification: { select: { name: true, code: true } },
      createdBy:      { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
      assignedTo:     { select: { name: true, email: true } },
    },
  });

  if (!asset) notFound();

  if (!user.isSystem && !canEdit && asset.createdById !== user.id) {
    redirect(`/assets/${params.id}`);
  }

  const hasUnsubmittedRevision = asset.pendingChanges != null && !asset.pendingChangeInstanceId;
  if (asset.approvalStatus !== "PENDING_APPROVAL" && !hasUnsubmittedRevision) {
    redirect(`/assets/${params.id}`);
  }

  const displayAsset = hasUnsubmittedRevision
    ? { ...asset, ...(asset.pendingChanges as Record<string, any>) }
    : asset;

  if (hasUnsubmittedRevision) {
    const pc = asset.pendingChanges as Record<string, any>;
    if (pc.entityId && pc.entityId !== asset.entityId) {
      const e = await prisma.entity.findUnique({ where: { id: pc.entityId }, select: { id: true, name: true, code: true } });
      if (e) (displayAsset as any).entity = e;
    }
    if (pc.branchId && pc.branchId !== asset.branchId) {
      const b = await prisma.branch.findUnique({ where: { id: pc.branchId }, select: { name: true, code: true } });
      if (b) (displayAsset as any).branch = b;
    }
    if (pc.classificationId && pc.classificationId !== asset.classificationId) {
      const c = await prisma.assetClassification.findUnique({ where: { id: pc.classificationId }, select: { name: true, code: true } });
      (displayAsset as any).classification = c ?? null;
    }
  }

  const workflowInclude = {
    steps: {
      include: {
        role: { include: { users: { select: { id: true, name: true, email: true } } } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { stepNumber: "asc" as const },
    },
  };
  const workflow =
    (await prisma.approvalWorkflow.findFirst({
      where: { module: "assets", action: "REGISTER", isActive: true, entityId: asset.entityId },
      include: workflowInclude,
    })) ??
    (await prisma.approvalWorkflow.findFirst({
      where: { module: "assets", action: "REGISTER", isActive: true, entityId: null },
      include: workflowInclude,
    }));

  const stepsByNumber = new Map<
    number,
    { label: string; roleName: string; approvers: { name: string; email: string }[] }
  >();
  for (const step of workflow?.steps ?? []) {
    const entry = stepsByNumber.get(step.stepNumber) ?? {
      label: step.label ?? `Step ${step.stepNumber}`,
      roleName: step.role?.name ?? step.roleName ?? "",
      approvers: [],
    };
    if (step.userId && step.user) {
      entry.approvers.push({ name: step.user.name, email: step.user.email });
    } else if (step.role) {
      entry.approvers.push(...step.role.users.map((u) => ({ name: u.name, email: u.email })));
    }
    if (!entry.roleName && step.role?.name) entry.roleName = step.role.name;
    stepsByNumber.set(step.stepNumber, entry);
  }
  const approverSteps = Array.from(stepsByNumber.entries())
    .sort(([a], [b]) => a - b)
    .map(([stepNumber, v]) => ({ stepNumber, ...v }));

  const depreciationPerYear  = displayAsset.acquisitionValue
    ? Number(displayAsset.acquisitionValue) / displayAsset.usefulLifeYrs
    : 0;
  const depreciationPerMonth = depreciationPerYear / 12;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="yellow">{hasUnsubmittedRevision ? "✏️ Pending Update" : "📋 Pending Review"}</Badge>
            <span className="text-xs text-muted-foreground">
              {hasUnsubmittedRevision
                ? "Review the changes below before submitting — the live asset stays unchanged until an approver signs off."
                : "Review all details before submitting"}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {hasUnsubmittedRevision ? "Asset Update Preview" : "Asset Requisition Preview"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registered by: <strong>{asset.createdBy.name}</strong> ({asset.createdBy.role.name}) · {new Date(asset.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/assets/${params.id}/edit`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-bold hover:bg-accent"
          >
            ✏️ Edit Again
          </Link>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <h2 className="font-bold text-foreground">Asset Details</h2>
        </div>
        <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {[
            ["Asset Tag",          displayAsset.assetNo],
            ["Asset Name",         displayAsset.name],
            ["Classification",     displayAsset.classification?.name ?? "—"],
            ["Entity",             `${displayAsset.entity.name} (${displayAsset.entity.code})`],
            ["Branch",             `${displayAsset.branch?.name ?? "—"}${displayAsset.branch?.code ? ` (${displayAsset.branch.code})` : ""}`],
            ["Location",           displayAsset.location ?? "—"],
            ["Make / Model",       [displayAsset.make, displayAsset.model].filter(Boolean).join(" / ") || "—"],
            ["Serial No.",         displayAsset.serialNo ?? "—"],
            ["Condition",          displayAsset.condition],
            ["Movable",            displayAsset.isMovable ? "Yes" : "No — Fixed Asset"],
            ["Acquisition Value",  displayAsset.acquisitionValue ? formatCompact(Number(displayAsset.acquisitionValue)) : "—"],
            ["Residual Value",     displayAsset.residualValue ? formatCompact(Number(displayAsset.residualValue)) : "—"],
            ["Useful Life",        `${displayAsset.usefulLifeYrs} years`],
            ["Depreciation",       displayAsset.depreciationMethod.replace("_", "-")],
            ["Depr./Month",        depreciationPerMonth > 0 ? formatCompact(depreciationPerMonth) : "—"],
            ["Depr./Year",         depreciationPerYear > 0 ? formatCompact(depreciationPerYear) : "—"],
            ["GL Account",         displayAsset.glAccountCode ?? "—"],
            ["Purchase Date",      displayAsset.purchaseDate ? new Date(displayAsset.purchaseDate).toLocaleDateString("en-NG") : "—"],
            ["Supplier",           displayAsset.supplier ?? "—"],
            ["Invoice Ref.",       displayAsset.invoiceRef ?? "—"],
            ["Warranty Expiry",    displayAsset.warrantyExpiry ? new Date(displayAsset.warrantyExpiry).toLocaleDateString("en-NG") : "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
              <div className="text-foreground font-medium">{value}</div>
            </div>
          ))}
        </div>
        {asset.description && (
          <div className="px-6 pb-6">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Description</div>
            <p className="text-sm text-foreground">{asset.description}</p>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground">Approval Workflow</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {workflow
              ? `This requisition will go through ${approverSteps.length} approval step${approverSteps.length !== 1 ? "s" : ""}`
              : "No active workflow found — submission will be recorded but no approvers notified"}
          </p>
        </div>

        <div className="p-6">
          {approverSteps.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground text-sm">
              ⚠️ No approval workflow is configured for asset registration. Contact your administrator.
            </div>
          ) : (
            <div className="flex items-start gap-0 overflow-x-auto pb-2">
              <div className="flex flex-col items-center gap-2 min-w-[120px]">
                <div className="w-10 h-10 rounded-full bg-[#1B2A8A] text-white flex items-center justify-center text-sm font-extrabold">
                  {asset.createdBy.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-foreground">{asset.createdBy.name}</div>
                  <div className="text-[10px] text-muted-foreground">{asset.createdBy.role.name}</div>
                  <Badge variant="blue" className="mt-1 text-[9px]">Submitter</Badge>
                </div>
              </div>

              {approverSteps.map((step) => (
                <div key={step.stepNumber} className="flex items-start">
                  <div className="flex items-center mt-5 px-1">
                    <div className="h-px w-8 bg-border" />
                    <div className="text-muted-foreground text-xs">→</div>
                    <div className="h-px w-8 bg-border" />
                  </div>

                  <div className="flex flex-col items-center gap-2 min-w-[130px]">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 border-2 border-amber-400 text-amber-700 dark:text-amber-400 flex items-center justify-center text-sm font-extrabold">
                      {step.stepNumber}
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-foreground">{step.label}</div>
                      <div className="text-[10px] text-muted-foreground font-medium">{step.roleName}</div>
                      {step.approvers.length > 0 ? (
                        step.approvers.map((a) => (
                          <div key={a.email} className="text-[10px] text-muted-foreground mt-0.5">
                            {a.name}<br />
                            <span className="opacity-70">{a.email}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[10px] text-amber-600 mt-0.5">No user has this role yet</div>
                      )}
                      <Badge variant="yellow" className="mt-1 text-[9px]">Pending</Badge>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-start">
                <div className="flex items-center mt-5 px-1">
                  <div className="h-px w-8 bg-border" />
                  <div className="text-muted-foreground text-xs">→</div>
                  <div className="h-px w-8 bg-border" />
                </div>
                <div className="flex flex-col items-center gap-2 min-w-[110px] opacity-60">
                  <div className="w-10 h-10 rounded-full bg-muted border-2 border-dashed border-border text-muted-foreground flex items-center justify-center text-lg">
                    ✓
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-foreground">Once Approved</div>
                    <div className="text-[10px] text-muted-foreground">Asset will be activated</div>
                    <Badge variant="gray" className="mt-1 text-[9px]">Not yet reached</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AssetPreviewClient assetId={params.id} hasWorkflow={approverSteps.length > 0} isRevision={hasUnsubmittedRevision} />
    </div>
  );
}
