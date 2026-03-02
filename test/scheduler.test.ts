import { describe, it, expect, vi, afterEach } from "vitest";
import { startScheduler, stopScheduler, isSchedulerRunning } from "../src/sync/scheduler.ts";
import type { ChangelogConfig } from "../src/config.ts";

// Mock node-cron to avoid real scheduling
vi.mock("node-cron", () => ({
  default: {
    validate: (expr: string) => {
      // Simple validation: reject obviously invalid expressions
      return expr.split(" ").length === 5;
    },
    schedule: (_expr: string, _cb: () => void) => ({
      stop: vi.fn(),
    }),
  },
}));

const baseConfig: ChangelogConfig = {
  site: { title: "Test", description: "" },
  syncInterval: "0 */4 * * *",
  sources: [{ adapter: "manual" }],
};

describe("scheduler", () => {
  afterEach(() => {
    stopScheduler();
  });

  it("starts with a valid cron expression", () => {
    startScheduler(baseConfig);
    expect(isSchedulerRunning()).toBe(true);
  });

  it("stops cleanly", () => {
    startScheduler(baseConfig);
    expect(isSchedulerRunning()).toBe(true);

    stopScheduler();
    expect(isSchedulerRunning()).toBe(false);
  });

  it("rejects invalid cron expressions", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    startScheduler({
      ...baseConfig,
      syncInterval: "not-a-cron",
    });

    expect(isSchedulerRunning()).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid cron expression")
    );

    consoleSpy.mockRestore();
  });

  it("replaces previous scheduler on re-start", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    startScheduler(baseConfig);
    expect(isSchedulerRunning()).toBe(true);

    startScheduler(baseConfig);
    expect(isSchedulerRunning()).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Stopping previous")
    );

    consoleSpy.mockRestore();
  });
});
