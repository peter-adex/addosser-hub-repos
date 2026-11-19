import { Metadata }                       from "next";
import Link                               from "next/link";
import { redirect }                       from "next/navigation";
import { hasGranularPermission, requireAuth } from "@/lib/permissions";
import { prisma }                         from "@/lib/prisma";
import { formatNGN }                  from "@/lib/utils";
import { Badge }                          from "@/components/shared/Badge";
import { StatCard }                       from "@/components/shared/StatCard";
import ApprovalActionButtons              from "@/components/assets/ApprovalActionButtons";
import { PENDING_FIELD_LABELS, formatPendingFieldValue } from "@/lib/asset-field-labels";

export const metadata: Metadata = { title: "Asset Approvals Queue" };

export default async function ApprovalsPage() {
  const canSeeQueue =
    (await hasGranularPermission("assets", "approvals", "approve")) ||
    (await hasGranularPermission("assets", "dispose", "approve")) ||
    (await hasGranularPermission("assets", "movement", "approve")) ||
    (await hasGranularPermission("assets", "split", "approve"));
  if (!canSeeQueue) redirect("/unauthorized");

  const user = await requireAuth();

  const pending = await prisma.approvalInstance.findMany({
    where: {
      status:   "IN_PROGRESS",
      workflow: { module: "assets" },
      steps: {
        some: {
          status:      "PENDING",
          approvedById: null,
          OR: [
            { userId: user.id },
            { roleId: user.roleId },
          ],
        },
      },
    },
    include: {
      workflow:  { select: { name: true, module: true } },
      steps: {
        include: { actionedBy: { select: { name: true } } },
        orderBy: { stepNumber: "asc" },
      },
      entity:    { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const enriched = await Promise.all(
    pending.map(async (inst) => {
      const myStep = inst.steps.find(
        (s) => s.status === "PENDING" && !s.approvedById && (s.userId === user.id || s.roleId === user.roleId)
      );

      if (inst.resourceType === "AssetMovement") {
        const movement = await prisma.assetMovement.findUnique({
          where:   { id: inst.resourceId },
          include: {
            asset:       { select: { assetNo: true, name: true } },
            fromEntity:  { select: { name: true, code: true } },
            toEntity:    { select: { name: true, code: true } },
            requestedBy: { select: { name: true, email: true } },
          },
        });
        return { ...inst, asset: null, movement, myStep };
      }

      const asset = await prisma.asset.findUnique({
        where:   { id: inst.resourceId },
        include: {
          branch:         { select: { name: true } },
          classification: { select: { name: true } },
          createdBy:      { select: { name: true, email: true } },
        },
      });
      return { ...inst, asset, movement: null, myStep };
    })
  );

  const myPending    = enriched.length;
  const totalApproved = await prisma.approvalInstance.count({
    where: { workflow: { module: "assets" }, status: "FULLY_APPROVED" },
  });
  const totalRejected = await prisma.approvalInstance.count({
    where: { workflow: { module: "assets" }, status: "REJECTED" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Asset Approvals Queue</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Asset registration and movement requests pending your approval as <strong>{user.roleName}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Pending My Approval" value={myPending}    icon="⏳" color="#d97706" />
        <StatCard label="Fully Approved"       value={totalApproved} icon="✅" color="#16a34a" />
        <StatCard label="Rejected"             value={totalRejected} icon="❌" color="#dc2626" />
      </div>

      {enriched.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-20 flex flex-col items-center gap-3 text-muted-foreground">
          <span className="text-5xl">✅</span>
          <span className="font-bold text-foreground">All clear — no pending approvals</span>
          <p className="text-sm">Newly registered assets will appear here for your review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {enriched.map(({ asset, movement, myStep, steps, entity, workflow, id: instanceId, resourceType }) => {
            const isRevision =
              resourceType === "Asset" &&
              asset?.pendingChangeInstanceId === instanceId &&
              asset?.pendingChanges != null;
            return (
            <div key={instanceId} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs font-bold text-foreground">
                        {resourceType === "AssetMovement" ? (movement?.assetCodeSnapshot ?? movement?.asset.assetNo) : asset?.assetNo ?? "—"}
                      </code>
                      <Badge variant="navy">{workflow.name}</Badge>
                      {resourceType === "AssetMovement" && <Badge variant="blue">Movement Request</Badge>}
                      {isRevision && <Badge variant="yellow">✏️ Proposed Update</Badge>}
                      <Badge variant="yellow">Awaiting Step {myStep?.stepNumber}</Badge>
                    </div>
                    <h2 className="font-bold text-foreground text-lg">
                      {resourceType === "AssetMovement" ? (movement?.assetDescSnapshot ?? movement?.asset.name ?? "Unknown Asset") : asset?.name ?? "Unknown Asset"}
                    </h2>
                    {resourceType === "AssetMovement" ? (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {movement?.fromEntity?.code} → {movement?.toEntity?.code}
                        {movement?.reason ? ` · ${movement.reason}` : ""}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {entity.name} ({entity.code})
                        {asset?.branch ? ` · ${asset.branch.name}` : ""}
                        {asset?.classification ? ` · ${asset.classification.name}` : ""}
                      </p>
                    )}
                  </div>

                  {resourceType !== "AssetMovement" && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Acquisition Value</div>
                      <div className="text-xl font-extrabold text-foreground">
                        {asset?.acquisitionValue
                          ? formatNGN(Number(asset.acquisitionValue))
                          : "—"}
                      </div>
                    </div>
                  )}
                </div>

                {resourceType === "AssetMovement" && movement?.requestedBy && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Requested by <strong>{movement.requestedBy.name}</strong> ({movement.requestedBy.email})
                    · {new Date(movement.movementDate).toLocaleDateString("en-NG", { dateStyle: "medium" })}
                  </p>
                )}
                {resourceType !== "AssetMovement" && asset?.createdBy && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {isRevision ? "Update requested by" : "Registered by"} <strong>{asset.createdBy.name}</strong> ({asset.createdBy.email})
                    · {asset?.createdAt ? new Date(asset.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" }) : ""}
                  </p>
                )}

                {isRevision && (
                  <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-2">
                      Proposed Changes
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                      {Object.entries(asset!.pendingChanges as Record<string, any>).map(([key, newVal]) => (
                        <div key={key}>
                          <div className="font-semibold text-amber-800 dark:text-amber-300">
                            {PENDING_FIELD_LABELS[key] ?? key}
                          </div>
                          <div className="text-amber-700 dark:text-amber-400">
                            <span className="line-through opacity-60">{formatPendingFieldValue((asset as any)[key])}</span>
                            {" → "}
                            <strong>{formatPendingFieldValue(newVal)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-b border-border bg-muted/20">
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {steps.map((step, idx) => {
                    const isMine = step.status === "PENDING" && (step.userId === user.id || step.roleId === user.roleId);
                    return (
                    <div key={step.id} className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${
                          step.status === "APPROVED"  ? "bg-green-500 text-white" :
                          step.status === "REJECTED"  ? "bg-red-500 text-white" :
                          isMine ? "bg-[#FFB800] text-[#1B2A8A] ring-2 ring-[#FFB800] ring-offset-2" :
                          step.status === "PENDING"   ? "bg-muted text-muted-foreground border border-border" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {step.status === "APPROVED" ? "✓" : step.status === "REJECTED" ? "✗" : step.stepNumber}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground">{step.userName || step.roleName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {step.status === "APPROVED" && step.actionedBy
                              ? `✓ ${step.actionedBy.name} · ${step.actionedAt ? new Date(step.actionedAt).toLocaleDateString("en-NG") : ""}`
                              : isMine
                              ? "⬆️ Your turn"
                              : step.status === "PENDING"
                              ? "⏳ Awaiting"
                              : step.status}
                          </div>
                        </div>
                      </div>
                      {idx < steps.length - 1 && (
                        <div className={`h-0.5 w-10 flex-shrink-0 ${
                          step.status === "APPROVED" ? "bg-green-500" : "bg-border"
                        }`} />
                      )}
                    </div>
                  );})}
                </div>
              </div>

              {myStep && (
                <div className="px-6 py-5">
                  <ApprovalActionButtons
                    instanceId={instanceId}
                    stepNumber={myStep.stepNumber}
                    roleName={user.roleName}
                  />
                </div>
              )}

              <div className="px-6 pb-4">
                {resourceType === "AssetMovement" && movement && (
                  <Link href={`/assets/movements/${movement.id}`}
                    className="text-xs font-bold text-[#1B2A8A] dark:text-blue-400 hover:underline">
                    View full movement request →
                  </Link>
                )}
                {resourceType !== "AssetMovement" && asset && (
                  <Link href={`/assets/${asset.id}`}
                    className="text-xs font-bold text-[#1B2A8A] dark:text-blue-400 hover:underline">
                    View full asset record →
                  </Link>
                )}
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}
