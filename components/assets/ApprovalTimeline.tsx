"use client";

import { CheckCircle2, Clock, XCircle, Circle, ChevronRight } from "lucide-react";

export interface ApprovalStep {
  stepNumber:   number;
  roleName:     string;
  approverName: string | null;
  status:       "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
  actionedAt:   string | null;
  comment:      string | null;
}

export interface ApprovalTimelineProps {
  steps:          ApprovalStep[];
  overallStatus:  "IN_PROGRESS" | "FULLY_APPROVED" | "REJECTED" | "CANCELLED";
  requestedBy:    string;
  requestedAt:    string;
  compact?:       boolean;
}

function StepIcon({ status, size = 20 }: { status: ApprovalStep["status"]; size?: number }) {
  switch (status) {
    case "APPROVED": return <CheckCircle2 size={size} className="text-green-500" />;
    case "REJECTED": return <XCircle       size={size} className="text-red-500" />;
    case "PENDING":  return <Clock         size={size} className="text-amber-500" />;
    default:         return <Circle        size={size} className="text-muted-foreground/40" />;
  }
}

function StatusBadge({ status }: { status: ApprovalTimelineProps["overallStatus"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    IN_PROGRESS:    { label: "Awaiting Approval", cls: "bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950/30  dark:text-amber-400  dark:border-amber-800" },
    FULLY_APPROVED: { label: "Fully Approved",    cls: "bg-green-50  text-green-700  border-green-200  dark:bg-green-950/30  dark:text-green-400  dark:border-green-800" },
    REJECTED:       { label: "Rejected",           cls: "bg-red-50    text-red-700    border-red-200    dark:bg-red-950/30    dark:text-red-400    dark:border-red-800"   },
    CANCELLED:      { label: "Cancelled",          cls: "bg-muted     text-muted-foreground border-border" },
  };
  const { label, cls } = map[status] ?? map.CANCELLED;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>
      {label}
    </span>
  );
}

export default function ApprovalTimeline({
  steps,
  overallStatus,
  requestedBy,
  requestedAt,
  compact = false,
}: ApprovalTimelineProps) {
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("en-NG", {
          day:    "numeric",
          month:  "short",
          year:   "numeric",
          hour:   "2-digit",
          minute: "2-digit",
        })
      : null;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusBadge status={overallStatus} />
        <div className="flex items-center gap-1 ml-1">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <StepIcon status={step.status} size={14} />
              {i < steps.length - 1 && <ChevronRight size={10} className="text-muted-foreground/40" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-foreground">Approval Workflow</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submitted by <strong>{requestedBy}</strong> on {fmtDate(requestedAt)}
          </p>
        </div>
        <StatusBadge status={overallStatus} />
      </div>

      <div className="relative">
        <div
          className="absolute left-[19px] top-6 bottom-6 w-0.5"
          style={{ background: "hsl(var(--border))" }}
        />

        <div className="space-y-0">
          {steps.map((step, index) => {
            const isLast    = index === steps.length - 1;
            const actioned  = step.status === "APPROVED" || step.status === "REJECTED";

            return (
              <div key={index} className="flex gap-4 relative">
                <div className="relative z-10 flex-shrink-0 w-10 flex justify-center pt-3">
                  <div className="bg-card rounded-full p-0.5">
                    <StepIcon status={step.status} size={22} />
                  </div>
                </div>

                <div className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
                  <div className="flex items-start justify-between gap-2 pt-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Step {step.stepNumber}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{step.roleName}</span>
                      </div>

                      {actioned && step.approverName && (
                        <p className="text-sm text-foreground mt-1">
                          <span className="text-muted-foreground">{step.status === "APPROVED" ? "Approved" : "Rejected"} by </span>
                          <strong>{step.approverName}</strong>
                        </p>
                      )}

                      {step.comment && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic bg-muted/40 px-3 py-1.5 rounded-lg">
                          "{step.comment}"
                        </p>
                      )}

                      {step.status === "PENDING" && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                          ⏳ Awaiting approval from {step.roleName}
                        </p>
                      )}

                      {step.status === "SKIPPED" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Waiting for previous steps to be approved
                        </p>
                      )}
                    </div>

                    {step.actionedAt && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 text-right">
                        {fmtDate(step.actionedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {overallStatus === "FULLY_APPROVED" && (
        <div className="mt-2 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-green-700 dark:text-green-400">
            All approvals received — record is fully approved
          </span>
        </div>
      )}

      {overallStatus === "REJECTED" && (
        <div className="mt-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex items-center gap-2">
          <XCircle size={16} className="text-red-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">
            This record was rejected — please review comments and resubmit
          </span>
        </div>
      )}
    </div>
  );
}
