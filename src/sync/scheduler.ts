import cron from "node-cron";
import type { ChangelogConfig } from "../config.ts";
import { syncAll } from "./engine.ts";

let task: cron.ScheduledTask | null = null;

export function startScheduler(config: ChangelogConfig): void {
  const expression = config.syncInterval;

  if (!cron.validate(expression)) {
    console.error(`[scheduler] Invalid cron expression: "${expression}". Scheduler not started.`);
    return;
  }

  if (task) {
    console.log("[scheduler] Stopping previous scheduler.");
    task.stop();
  }

  console.log(`[scheduler] Starting with schedule: ${expression}`);

  task = cron.schedule(expression, async () => {
    console.log(`[scheduler] Sync triggered at ${new Date().toISOString()}`);
    try {
      const results = await syncAll(config);
      const summary = results
        .map((r) => `${r.adapter}: +${r.added} ~${r.updated}${r.errors.length ? " (errors)" : ""}`)
        .join(", ");
      console.log(`[scheduler] Sync complete: ${summary}`);
    } catch (err) {
      console.error(`[scheduler] Sync failed:`, (err as Error).message);
    }
  });
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = null;
    console.log("[scheduler] Stopped.");
  }
}

export function isSchedulerRunning(): boolean {
  return task !== null;
}
