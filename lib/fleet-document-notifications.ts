import { prisma } from "@/lib/prisma";
import { getFleetNotificationSettings } from "@/lib/fleet-notification-settings";
import {
  decideNotification,
  getAssignedUser,
  resolveRecipients,
  IN_FLIGHT_MS,
  type LogFact,
} from "@/lib/fleet-document-notification-rules";
import { buildDocumentNotificationEmail } from "@/lib/fleet-document-email";
import { sendMail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/base-url";
import { logFleetAudit } from "@/lib/audit";
import { lagosDayStartMs } from "@/lib/utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export interface FleetNotificationRunResult {
  skipped?: string;
  documentsChecked: number;
  reminders: number;
  critical: number;
  failed: number;
  skippedNoRecipients: number;
  skippedDuplicate: number;
}

let running = false;

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

export async function processFleetDocumentNotifications(
  now: Date = new Date(),
): Promise<FleetNotificationRunResult> {
  const result: FleetNotificationRunResult = {
    documentsChecked: 0,
    reminders: 0,
    critical: 0,
    failed: 0,
    skippedNoRecipients: 0,
    skippedDuplicate: 0,
  };

  if (running) return { ...result, skipped: "already-running" };
  running = true;

  try {
    const cfg = await getFleetNotificationSettings();
    const reminderOn = cfg.enableExpiryNotifications && cfg.reminderDaysBeforeExpiry.length > 0;
    const criticalOn = cfg.enableCriticalNotifications;
    if (!reminderOn && !criticalOn) return { ...result, skipped: "disabled" };

    const today = lagosDayStartMs(now);
    const expiryWindow: Record<string, unknown>[] = [];
    if (criticalOn) expiryWindow.push({ expiryDate: { lt: new Date(today) } });
    if (reminderOn) {
      const maxDays = Math.max(...cfg.reminderDaysBeforeExpiry);
      expiryWindow.push({
        expiryDate: { gte: new Date(today), lte: new Date(today + maxDays * MS_PER_DAY) },
      });
    }

    const candidates = await prisma.vehicleDocument.findMany({
      where: { expiryDate: { not: null }, OR: expiryWindow },
      select: {
        id: true,
        vehicleId: true,
        type: true,
        documentTypeId: true,
        expiryDate: true,
        documentType: { select: { name: true, isActive: true } },
        vehicle: {
          select: {
            plateNumber: true,
            make: true,
            model: true,
            year: true,
            statusStaffName: true,
            statusStaffEmail: true,
            assignedDriver: { select: { user: { select: { name: true, email: true } } } },
          },
        },
      },
    });
    if (candidates.length === 0) return result;

    const siblings = await prisma.vehicleDocument.findMany({
      where: {
        expiryDate: { not: null },
        vehicleId: { in: Array.from(new Set(candidates.map((c) => c.vehicleId))) },
      },
      select: { id: true, vehicleId: true, type: true, documentTypeId: true, expiryDate: true },
    });
    const groupKey = (d: { vehicleId: string; documentTypeId: string | null; type: string }) =>
      `${d.vehicleId}::${d.documentTypeId ?? `legacy:${d.type}`}`;
    const winner = new Map<string, { id: string; expiry: number }>();
    for (const s of siblings) {
      const k = groupKey(s);
      const e = s.expiryDate!.getTime();
      const cur = winner.get(k);
      if (!cur || e > cur.expiry || (e === cur.expiry && s.id < cur.id)) {
        winner.set(k, { id: s.id, expiry: e });
      }
    }

    const logRows = await prisma.fleetDocumentNotificationLog.findMany({
      where: { vehicleDocumentId: { in: candidates.map((c) => c.id) } },
      select: {
        vehicleDocumentId: true,
        notificationType: true,
        thresholdDays: true,
        expiryDate: true,
        status: true,
        sentAt: true,
      },
    });
    const logsByDoc = new Map<string, LogFact[]>();
    const failedCount = new Map<string, number>();
    for (const l of logRows) {
      const arr = logsByDoc.get(l.vehicleDocumentId) ?? [];
      arr.push(l);
      logsByDoc.set(l.vehicleDocumentId, arr);
      if (l.status === "failed") {
        const k = `${l.vehicleDocumentId}|${l.notificationType}|${l.thresholdDays}|${l.expiryDate.getTime()}`;
        failedCount.set(k, (failedCount.get(k) ?? 0) + 1);
      }
    }

    for (const doc of candidates) {
      try {
        const expiry = doc.expiryDate!;
        if (winner.get(groupKey(doc))?.id !== doc.id) continue;
        if (doc.documentType && !doc.documentType.isActive) continue;
        result.documentsChecked++;

        const decision = decideNotification(expiry, logsByDoc.get(doc.id) ?? [], cfg, now);
        if (!decision) continue;

        const failKey = `${doc.id}|${decision.kind}|${decision.thresholdDays}|${expiry.getTime()}`;
        if ((failedCount.get(failKey) ?? 0) >= MAX_FAILED_ATTEMPTS) continue;

        const assigned = getAssignedUser(doc.vehicle);
        const recipients = resolveRecipients(cfg, assigned);
        if (recipients.length === 0) {
          result.skippedNoRecipients++;
          continue;
        }

        const claim = await prisma.fleetDocumentNotificationLog.create({
          data: {
            vehicleDocumentId: doc.id,
            notificationType: decision.kind,
            thresholdDays: decision.thresholdDays,
            expiryDate: expiry,
            recipients,
            status: "sending",
          },
        });

        const rivals = await prisma.fleetDocumentNotificationLog.findMany({
          where: {
            vehicleDocumentId: doc.id,
            notificationType: decision.kind,
            expiryDate: expiry,
            ...(decision.kind === "reminder" ? { thresholdDays: decision.thresholdDays } : {}),
            id: { not: claim.id },
            status: { in: ["sending", "sent"] },
            sentAt: { gte: new Date(now.getTime() - IN_FLIGHT_MS) },
          },
          select: { id: true, sentAt: true },
        });
        const lostRace = rivals.some(
          (r) =>
            r.sentAt.getTime() < claim.sentAt.getTime() ||
            (r.sentAt.getTime() === claim.sentAt.getTime() && r.id < claim.id),
        );
        if (lostRace) {
          await prisma.fleetDocumentNotificationLog.delete({ where: { id: claim.id } });
          result.skippedDuplicate++;
          continue;
        }

        const v = doc.vehicle;
        const plate = oneLine(v.plateNumber);
        const docType = oneLine(doc.documentType?.name ?? doc.type);
        const email = buildDocumentNotificationEmail(decision.kind, {
          plateNumber: plate,
          vehicleDescription: oneLine(`${v.year ?? ""} ${v.make} ${v.model}`),
          documentType: docType,
          expiryDate: expiry,
          daysRemaining: decision.daysRemaining,
          assignedUserName: assigned?.name ?? null,
          assignedUserEmail: assigned?.email ?? null,
          registerUrl: `${getBaseUrl()}/fleet/vehicle-document-register`,
        });

        let ok = false;
        let errorMsg: string | null = null;
        try {
          const sent = await sendMail({
            to: recipients,
            subject: email.subject,
            html: email.html,
            text: email.text,
          });
          ok = sent.success;
          if (!ok) errorMsg = "Mail was not delivered (SMTP not configured or the send failed)";
        } catch (err) {
          errorMsg = err instanceof Error ? err.message : String(err);
        }

        await prisma.fleetDocumentNotificationLog.update({
          where: { id: claim.id },
          data: { status: ok ? "sent" : "failed", error: errorMsg?.slice(0, 2000) ?? null },
        });

        if (!ok) result.failed++;
        else if (decision.kind === "reminder") result.reminders++;
        else result.critical++;

        logFleetAudit(null, {
          userName: "System (Fleet notification scheduler)",
          action: "NOTIFY",
          resource: "VehicleDocument",
          resourceId: doc.id,
          status: ok ? "success" : "failed",
          details: {
            notificationType: decision.kind,
            plateNumber: plate,
            documentType: docType,
            thresholdDays: decision.thresholdDays,
            recipients,
            ...(errorMsg ? { error: errorMsg } : {}),
          },
        });
      } catch (err) {
        result.failed++;
        console.error("[FleetDocNotifications] Failed processing document", doc.id, err);
      }
    }

    return result;
  } finally {
    running = false;
  }
}
