import { processDueReminders } from "@/lib/payment-v2";

const INTERVAL_MS = 5 * 60 * 1000;

declare global {
  var __reminderSchedulerStarted: boolean | undefined;
}

export function startReminderScheduler() {
  if (global.__reminderSchedulerStarted) {
    return;
  }
  global.__reminderSchedulerStarted = true;

  console.log(
    `[ReminderScheduler] Starting — checking for due reminders every ${INTERVAL_MS / 60000} minute(s).`,
  );

  const run = async () => {
    try {
      const result = await processDueReminders();
      if (result.processed > 0) {
        console.log(
          `[ReminderScheduler] Processed ${result.processed} due reminder(s) — ${result.sent} sent, ${result.failed} failed.`,
        );
      }
    } catch (err) {
      console.error("[ReminderScheduler] Run failed:", err);
    }
  };

  setTimeout(run, 15_000);
  setInterval(run, INTERVAL_MS);
}
