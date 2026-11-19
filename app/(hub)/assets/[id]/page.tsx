import { Metadata }                        from "next";
import Link                                from "next/link";
import { notFound }                        from "next/navigation";
import { requireGranularPermission, requireAuth, hasGranularPermission } from "@/lib/permissions";
import { prisma }                          from "@/lib/prisma";
import { formatNGN }                   from "@/lib/utils";
import { calcDepreciation }                from "@/lib/depreciation";
import { Badge }                           from "@/components/shared/Badge";
import { StatCard }                        from "@/components/shared/StatCard";
import { getAssetCostHistory }             from "@/lib/asset-cost-history";
import AssetCostHistorySection             from "@/components/invoice/AssetCostHistorySection";
import AssetDetailActions                  from "@/components/assets/AssetDetailActions";
import { PENDING_FIELD_LABELS, formatPendingFieldValue } from "@/lib/asset-field-labels";
import CancelAssetRevisionButton           from "@/components/assets/CancelAssetRevisionButton";

export const metadata: Metadata = { title: "Asset Detail" };

const CONDITION_VARIANT: Record<string, "green"|"blue"|"yellow"|"red"> = {
  EXCELLENT: "green", GOOD: "blue", FAIR: "yellow", POOR: "red", CONDEMNED: "red",
};
const STATUS_VARIANT: Record<string, "green"|"yellow"|"red"|"gray"> = {
  ACTIVE: "green", UNDER_MAINTENANCE: "yellow", DISPOSED: "red", MISSING: "red",
  DONATED: "gray", TRANSFERRED: "gray",
};
const MAINTENANCE_ICON: Record<string, string> = {
  PREVENTIVE: "🔧", CORRECTIVE: "🛠️", INSPECTION: "🔍", CALIBRATION: "⚖️", UPGRADE: "⬆️",
};

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  await requireGranularPermission("assets", "edit", "view");
  const user = await requireAuth();

  const canEditAsset  = user.isSystem || (await hasGranularPermission("assets", "edit", "edit"));
  const canSplitAsset = user.isSystem || (await hasGranularPermission("assets", "split", "create"));
  const canDisposeAsset = user.isSystem || (await hasGranularPermission("assets", "dispose", "create"));
  const canLogMaintenance = canSplitAsset;

  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: {
      entity:          { select: { name: true, code: true } },
      branch:          { select: { name: true, code: true } },
      classification:  { select: { name: true } },
      assignedTo:      { select: { name: true, email: true } },
      createdBy:       { select: { name: true } },
      maintenanceLogs: { orderBy: { performedAt: "desc" } },
      depreciations:   { orderBy: { year: "asc" } },
      documents:       { orderBy: { createdAt: "desc" } },
      parentAsset:     { select: { id: true, assetNo: true, name: true } },
      splitEvent:      { select: { id: true, effectiveDate: true, reason: true } },
      splitsOfThis:    {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, status: true, quantitySplit: true, effectiveDate: true, createdAt: true,
          children: { select: { id: true, assetNo: true } },
        },
      },
    },
  });

  if (!asset) notFound();

  if (!user.isSystem && asset.entityId !== user.entityId) notFound();

  const linkedBudget = asset.budgetRef
    ? await prisma.budget.findUnique({
        where: { id: asset.budgetRef },
        include: { entityGL: { include: { glAccount: true } } },
      })
    : null;

  const totalMaintenance = asset.maintenanceLogs.reduce(
    (s, m) => s + Number(m.cost ?? 0), 0
  );

  const approvalInstance = await prisma.approvalInstance.findFirst({
    where: { resourceId: asset.id, resourceType: "Asset" },
    orderBy: { createdAt: "desc" },
    include: {
      workflow: { select: { name: true } },
      steps: {
        include: {
          actionedBy: { select: { name: true, email: true } },
          assignedUser: { select: { name: true, email: true, role: { select: { name: true } } } },
        },
        orderBy: { stepNumber: "asc" },
      },
    },
  });

  const costHistory = await getAssetCostHistory(asset.id);

  const acquisitionValue = Number(asset.acquisitionValue ?? 0);
  const residualValue    = Number(asset.residualValue ?? 0);

  const liveDepr = calcDepreciation(
    asset.purchaseDate,
    acquisitionValue,
    residualValue,
    asset.usefulLifeYrs,
    asset.depreciationMethod,
  );

  const bookValue = liveDepr
    ? liveDepr.netBookValue
    : Number(asset.currentBookValue ?? asset.acquisitionValue ?? 0);

  const accumulatedDepreciation = liveDepr
    ? liveDepr.accumulatedDepr
    : Math.max(0, acquisitionValue - bookValue);

  const photos: string[] = asset.photos ? JSON.parse(asset.photos) : [];

  const inputStyles = "bg-muted/40 rounded-xl p-4 border border-border";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/assets" className="hover:text-foreground">Assets</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{asset.name}</span>
      </div>

      {asset.pendingChanges && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-2xl p-5">
          <div className="flex items-start gap-2">
            <span className="text-lg">✏️</span>
            <div className="flex-1">
              <div className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                {asset.pendingChangeInstanceId
                  ? "Update Pending Approval"
                  : "Unsubmitted Update — Draft"}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                {asset.pendingChangeInstanceId
                  ? "The changes below have been submitted for approval. This asset's live data (shown throughout this page) is unaffected until an approver decides."
                  : "These changes were saved but not yet submitted for approval — nothing has changed yet. Review and submit, or cancel, on the preview page."}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 mt-3 text-xs">
                {Object.entries(asset.pendingChanges as Record<string, any>).map(([key, newVal]) => {
                  const label = PENDING_FIELD_LABELS[key] ?? key;
                  const oldVal = (asset as any)[key];
                  return (
                    <div key={key}>
                      <div className="font-semibold text-amber-800 dark:text-amber-300">{label}</div>
                      <div className="text-amber-700 dark:text-amber-400">
                        <span className="line-through opacity-60">{formatPendingFieldValue(oldVal, key)}</span>
                        {" → "}
                        <strong>{formatPendingFieldValue(newVal, key)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!asset.pendingChangeInstanceId && (
                <Link
                  href={`/assets/${asset.id}/preview`}
                  className="inline-block mt-3 text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline"
                >
                  Review & Submit for Approval →
                </Link>
              )}
              {asset.pendingChangeInstanceId && (user.isSystem || user.id === asset.createdById) && (
                <CancelAssetRevisionButton assetId={asset.id} />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <code className="bg-muted px-2.5 py-1 rounded-lg text-xs font-bold text-foreground">{asset.assetNo}</code>
            <Badge variant={CONDITION_VARIANT[asset.condition] ?? "gray"}>{asset.condition}</Badge>
            <Badge variant={STATUS_VARIANT[asset.status] ?? "gray"}>{asset.status.replace("_"," ")}</Badge>
            {(asset.classification?.name ?? asset.legacyCategory) && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: "#7c3aed" }}>
                {asset.classification?.name ?? asset.legacyCategory}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">{asset.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {asset.entity.name} {asset.branch ? `· ${asset.branch.name}` : ""}{asset.location ? ` · ${asset.location}` : ""}
          </p>
        </div>

        <div className="flex gap-2">
          <AssetDetailActions
            assetId={asset.id}
            assetName={asset.name}
            approvalStatus={asset.approvalStatus}
            hasSubmittedRevision={asset.pendingChangeInstanceId != null}
            canManage={asset.createdById === user.id || user.isSystem}
          />
          {canLogMaintenance && (
            <Link href={`/assets/${asset.id}/maintenance`}
              className="px-4 py-2.5 rounded-xl text-sm font-bold border border-border bg-card text-foreground hover:bg-accent">
              🔧 Log Maintenance
            </Link>
          )}
          {canSplitAsset && asset.quantity > 1 && asset.status === "ACTIVE" && asset.approvalStatus === "APPROVED" && (
            <Link href={`/assets/${asset.id}/split`}
              className="px-4 py-2.5 rounded-xl text-sm font-bold border border-border bg-card text-foreground hover:bg-accent">
              ✂️ Split Asset
            </Link>
          )}
          {canEditAsset && (
            <Link href={`/assets/${asset.id}/edit`}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#1B2A8A] border"
              style={{ background: "#FFB800", borderColor: "#FFB800" }}>
              Edit Asset
            </Link>
          )}
          {canDisposeAsset && ["ACTIVE", "UNDER_MAINTENANCE"].includes(asset.status) && asset.approvalStatus === "APPROVED" && (
            <Link href={`/assets/${asset.id}/dispose`}
              className="px-4 py-2.5 rounded-xl text-sm font-bold border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
              🗑️ Dispose Asset
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Acquisition Value" value={formatNGN(acquisitionValue)}                       icon="🏷️"  color="#1B2A8A" />
        <StatCard label="Book Value"        value={formatNGN(bookValue)}                            icon="📊"  color="#0284c7" />
        <StatCard label="Maintenance Cost"  value={formatNGN(totalMaintenance)}                     icon="🔧"  color="#d97706" />
        <StatCard label="Maintenance Logs"  value={asset.maintenanceLogs.length}                        icon="📋"  color="#7c3aed" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 space-y-4">

          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-bold text-foreground mb-4">Asset Information</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ["Asset No.",        asset.assetNo],
                ["Classification",   asset.classification?.name ?? asset.legacyCategory ?? "—"],
                ["Entity",          asset.entity.name],
                ["Branch",          asset.branch?.name ?? "—"],
                ["Location",        asset.location ?? "—"],
                ["Condition",       asset.condition],
                ["Status",          asset.status.replace("_"," ")],
                ["Assigned To",     asset.assignedTo?.name ?? "—"],
                ["Purchase Date",   asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString("en-NG") : "—"],
                ["Supplier",        asset.supplier ?? "—"],
                ["Invoice Ref.",    asset.invoiceRef ?? "—"],
                ["GL Account",      asset.glAccountCode ?? "—"],
                ["Useful Life",     asset.usefulLifeYrs ? `${asset.usefulLifeYrs} years` : "—"],
                ["Depreciation",    asset.depreciationMethod.replace("_"," ")],
                ["Warranty Expiry", asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString("en-NG") : "—"],
                ["Created By",      asset.createdBy.name],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
                  <div className="text-foreground font-medium">{value}</div>
                </div>
              ))}
            </div>

            {asset.description && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Description</div>
                <p className="text-sm text-foreground">{asset.description}</p>
              </div>
            )}
          </div>

          {approvalInstance && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
                Approval Workflow
                <span className="ml-auto text-xs text-muted-foreground font-normal">{approvalInstance.workflow.name}</span>
              </h2>
              <div className="relative">
                {approvalInstance.steps.map((step, index) => (
                  <div key={step.id} className="flex gap-3 mb-4 last:mb-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 text-xs font-bold ${
                        step.status === "APPROVED" ? "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-600" :
                        step.status === "REJECTED" ? "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-600" :
                        step.status === "PENDING" && approvalInstance.currentStep === step.stepNumber ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-600 animate-pulse" :
                        "border-border bg-muted text-muted-foreground"
                      }`}>
                        {step.status === "APPROVED" ? "✓" : step.status === "REJECTED" ? "✗" : step.stepNumber}
                      </div>
                      {index < approvalInstance.steps.length - 1 && (
                        <div className={`w-0.5 flex-1 mt-1 ${step.status === "APPROVED" ? "bg-green-500" : "bg-border"}`} style={{ minHeight: 24 }} />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-sm font-semibold text-foreground">
                          Step {step.stepNumber}: {step.userName || step.roleName}
                        </span>
                        <Badge variant={
                          step.status === "APPROVED" ? "green" :
                          step.status === "REJECTED" ? "red" :
                          step.status === "PENDING" ? "yellow" : "gray"
                        }>
                          {step.status}
                        </Badge>
                      </div>
                      {step.assignedUser && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {step.assignedUser.name}
                          {step.assignedUser.role?.name && ` · ${step.assignedUser.role.name}`}
                          {step.assignedUser.email && ` · ${step.assignedUser.email}`}
                        </div>
                      )}
                      {step.actionedBy && (
                        <div className="text-xs text-muted-foreground mt-1">
                          By: {step.actionedBy.name} ({step.actionedBy.email})
                          {step.actionedAt && ` · ${new Date(step.actionedAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}`}
                        </div>
                      )}
                      {step.status === "PENDING" && approvalInstance.currentStep === step.stepNumber && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">⏳ Awaiting approval</div>
                      )}
                      {step.comment && (
                        <div className="mt-2 text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-3 py-1.5">"{step.comment}"</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {approvalInstance.status === "FULLY_APPROVED" && (
                <div className="mt-1 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400 font-semibold">
                  ✓ Fully Approved — Asset Activated
                </div>
              )}
              {approvalInstance.status === "REJECTED" && (
                <div className="mt-1 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400 font-semibold">
                  ✗ Rejected
                </div>
              )}
            </div>
          )}

          {linkedBudget && (
            <div className="bg-card border border-[#7c3aed]/30 rounded-2xl p-5">
              <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
                <span className="text-[#7c3aed]">📊</span> Linked CAPEX Budget
              </h2>
              <div className="flex items-center gap-3">
                <code className="bg-[#ede9fe] text-[#7c3aed] px-2.5 py-1 rounded-lg text-xs font-bold">
                  {linkedBudget.entityGL.glAccount.code}
                </code>
                <span className="text-sm font-semibold text-foreground">{linkedBudget.entityGL.glAccount.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">FY {linkedBudget.financialYear}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <Link href={`/budgeting/${linkedBudget.id}`}
                  className="text-xs font-bold text-[#7c3aed] hover:underline">
                  View CAPEX Budget →
                </Link>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-foreground">Maintenance History</h2>
              {canLogMaintenance && (
                <Link href={`/assets/${asset.id}/maintenance`}
                  className="text-xs font-bold text-[#1B2A8A] dark:text-blue-400 hover:underline">
                  + Log Maintenance
                </Link>
              )}
            </div>

            {asset.maintenanceLogs.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <div className="text-3xl mb-2">🔧</div>
                <div className="text-sm font-semibold">No maintenance records yet</div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {asset.maintenanceLogs.map((log) => (
                  <div key={log.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg flex-shrink-0">{MAINTENANCE_ICON[log.type] ?? "📝"}</span>
                        <div>
                          <div className="font-semibold text-sm text-foreground">{log.type.replace("_"," ")} Maintenance</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{log.description ?? "No description"}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {log.cost && <div className="font-bold text-sm text-foreground">{formatNGN(Number(log.cost))}</div>}
                        <div className="text-xs text-muted-foreground">{new Date(log.performedAt).toLocaleDateString("en-NG")}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {log.vendor && <span>Vendor: {log.vendor}</span>}
                      {log.glAccountCode && <span>GL: {log.glAccountCode}</span>}
                      {log.nextDueAt && <span>Next due: {new Date(log.nextDueAt).toLocaleDateString("en-NG")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">

          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold text-foreground mb-4">Financials</h2>
            <div className="space-y-3">
              {[
                ...(asset.quantity > 1
                  ? [
                      { label: "Quantity",  value: `${asset.quantity} units`, color: "#1B2A8A" },
                      { label: "Unit Cost", value: formatNGN(Number(asset.unitCost ?? 0)), color: "#6b7280" },
                    ]
                  : []),
                { label: "Acquisition Value",  value: formatNGN(acquisitionValue),                     color: "#6b7280" },
                { label: "Current Book Value", value: formatNGN(bookValue),                            color: "#0284c7" },
                { label: "Residual Value",     value: formatNGN(residualValue),                        color: "#16a34a" },
                { label: "Accumulated Depreciation", value: formatNGN(accumulatedDepreciation),         color: "#dc2626" },
                ...(liveDepr
                  ? [
                      { label: "Monthly Depreciation", value: formatNGN(liveDepr.depreciationPerMonth), color: "#d97706" },
                      { label: "% Depreciated",        value: `${liveDepr.depreciationPct.toFixed(1)}%`,   color: "#7c3aed" },
                      { label: "Asset Age",            value: liveDepr.ageDisplay,                          color: "#6b7280" },
                    ]
                  : []),
                { label: "Maintenance Spent",  value: formatNGN(totalMaintenance),                     color: "#d97706" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <span className="text-sm font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
            {liveDepr?.isFullyDepreciated && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-400">
                ⚠️ Fully depreciated — book value has reached its residual value.
              </div>
            )}
          </div>

          {asset.depreciations.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border font-bold text-sm text-foreground">
                Depreciation Schedule
              </div>
              <div className="divide-y divide-border">
                {asset.depreciations.map((d) => (
                  <div key={d.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-foreground">FY {d.year}</div>
                      <div className="text-xs text-muted-foreground">Rate: {(Number(d.rate) * 100).toFixed(1)}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-red-600 font-semibold text-xs">-{formatNGN(Number(d.depreciationAmt))}</div>
                      <div className="text-xs text-muted-foreground">Closing: {formatNGN(Number(d.closingValue))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {photos.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-bold text-foreground mb-3">Photos</h2>
              <div className="grid grid-cols-2 gap-2">
                {photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Asset photo ${i + 1}`} className="w-full h-24 object-cover rounded-xl border border-border hover:opacity-90 transition" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {asset.documents.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-bold text-foreground mb-3">Documents</h2>
              <ul className="space-y-2">
                {asset.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-border bg-muted/30">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{doc.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {doc.documentType.replace(/_/g, " ")}
                        {doc.expiryDate && ` · expires ${new Date(doc.expiryDate).toLocaleDateString("en-NG")}`}
                      </div>
                    </div>
                    <a
                      href={`/api/download?url=${encodeURIComponent(doc.fileUrl)}&name=${encodeURIComponent(doc.title)}`}
                      className="text-xs font-semibold text-[#1B2A8A] hover:underline flex-shrink-0"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {asset.parentAsset && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-bold text-foreground mb-2">Split Origin</h2>
              <p className="text-sm text-muted-foreground">
                Created by splitting{" "}
                <Link href={`/assets/${asset.parentAsset.id}`} className="text-[#1B2A8A] hover:underline font-semibold">
                  {asset.parentAsset.assetNo}
                </Link>
                {asset.splitEvent?.effectiveDate && ` on ${new Date(asset.splitEvent.effectiveDate).toLocaleDateString("en-NG")}`}
                {asset.splitEvent?.reason && ` — "${asset.splitEvent.reason}"`}
              </p>
            </div>
          )}
          {asset.splitsOfThis?.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-bold text-foreground mb-3">Split History</h2>
              <ul className="space-y-2">
                {asset.splitsOfThis.map((s: any) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-border bg-muted/30">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{s.quantitySplit} unit(s) split — {new Date(s.effectiveDate).toLocaleDateString("en-NG")}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.children.length > 0
                          ? `Created: ${s.children.map((c: any) => c.assetNo).join(", ")}`
                          : "No assets created yet"}
                      </div>
                    </div>
                    <Link href={`/assets/splits/${s.id}`} className="text-xs font-semibold text-[#1B2A8A] hover:underline flex-shrink-0">
                      {s.status}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <AssetCostHistorySection
        assetName={`${asset.name} — ${asset.assetNo}`}
        summary={costHistory.summary}
        rows={costHistory.rows}
      />
    </div>
  );
}
