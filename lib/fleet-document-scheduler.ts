import { processFleetDocumentNotifications } from "@/lib/fleet-document-notifications";

const INTERVAL_MS = 30 * 60 * 1000;

declare global {
  var __fleetDocSchedulerStarted: boolean | undefined;
}

export function startFleetDocumentScheduler() {
  if (global.__fleetDocSchedulerStarted) return;
  global.__fleetDocSchedulerStarted = true;

  console.log(
    `[FleetDocScheduler] Starting — checking vehicle document expiries every ${INTERVAL_MS / 60000} minute(s).`,
  );

  const run = async () => {
    try {
      const r = await processFleetDocumentNotifications();
      if (r.reminders || r.critical || r.failed) {
        console.log(
          `[FleetDocScheduler] ${r.reminders} reminder(s), ${r.critical} critical, ${r.failed} failed.`,
        );
      }
    } catch (err) {
      console.error("[FleetDocScheduler] Run failed:", err);
    }
  };

  setTimeout(run, 60_000);
  setInterval(run, INTERVAL_MS);
}
