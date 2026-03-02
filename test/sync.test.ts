import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { setDb, closeDb, queryEntries, upsertEntries, getLatestSyncLogs } from "../src/db/client.ts";
import { assignIds, computeEntryId } from "../src/sync/dedup.ts";
import { syncAll } from "../src/sync/engine.ts";
import type { ChangelogEntry } from "../src/adapters/types.ts";
import type { ChangelogConfig } from "../src/config.ts";
import { setConfig } from "../src/config.ts";

function setupTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url).pathname, "utf-8");
  db.exec(schema);
  setDb(db);
  return db;
}

describe("dedup", () => {
  it("computes deterministic entry IDs", () => {
    const id1 = computeEntryId("github", "repo/123");
    const id2 = computeEntryId("github", "repo/123");
    const id3 = computeEntryId("blog", "repo/123");

    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1).toHaveLength(64); // sha256 hex
  });

  it("assigns IDs to entries", () => {
    const entries: ChangelogEntry[] = [
      {
        id: "",
        platform: "manual",
        platformId: "test-1",
        date: "2026-01-01T00:00:00Z",
        title: "Test",
      },
    ];

    const result = assignIds(entries);
    expect(result[0].id).toBeTruthy();
    expect(result[0].id).toHaveLength(64);
  });
});

describe("database operations", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    closeDb();
  });

  it("upserts new entries", () => {
    const entries = assignIds([
      {
        id: "",
        platform: "manual",
        platformId: "entry-1",
        date: "2026-01-01T00:00:00Z",
        title: "First entry",
        tags: ["test"],
      },
    ]);

    const result = upsertEntries(entries);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);

    const { entries: queried, total } = queryEntries();
    expect(total).toBe(1);
    expect(queried[0].title).toBe("First entry");
    expect(queried[0].tags).toContain("test");
  });

  it("updates existing entries on re-upsert", () => {
    const entries = assignIds([
      {
        id: "",
        platform: "manual",
        platformId: "entry-1",
        date: "2026-01-01T00:00:00Z",
        title: "Original title",
      },
    ]);

    upsertEntries(entries);

    const updated = assignIds([
      {
        id: "",
        platform: "manual",
        platformId: "entry-1",
        date: "2026-01-01T00:00:00Z",
        title: "Updated title",
      },
    ]);

    const result = upsertEntries(updated);
    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);

    const { entries: queried } = queryEntries();
    expect(queried[0].title).toBe("Updated title");
  });

  it("deduplicates same entry inserted twice", () => {
    const entries = assignIds([
      {
        id: "",
        platform: "manual",
        platformId: "entry-1",
        date: "2026-01-01T00:00:00Z",
        title: "Entry 1",
      },
      {
        id: "",
        platform: "manual",
        platformId: "entry-1",
        date: "2026-01-01T00:00:00Z",
        title: "Entry 1 duplicate",
      },
    ]);

    upsertEntries(entries);
    const { total } = queryEntries();
    expect(total).toBe(1);
  });

  it("filters by tag", () => {
    const entries = assignIds([
      {
        id: "",
        platform: "manual",
        platformId: "entry-1",
        date: "2026-01-01T00:00:00Z",
        title: "Tagged",
        tags: ["code", "release"],
      },
      {
        id: "",
        platform: "blog",
        platformId: "entry-2",
        date: "2026-01-02T00:00:00Z",
        title: "Not tagged",
        tags: ["writing"],
      },
    ]);

    upsertEntries(entries);

    const { entries: codeEntries, total } = queryEntries({ tag: "code" });
    expect(total).toBe(1);
    expect(codeEntries[0].title).toBe("Tagged");
  });

  it("filters by source platform", () => {
    const entries = assignIds([
      {
        id: "",
        platform: "manual",
        platformId: "entry-1",
        date: "2026-01-01T00:00:00Z",
        title: "Manual entry",
      },
      {
        id: "",
        platform: "blog",
        platformId: "entry-2",
        date: "2026-01-02T00:00:00Z",
        title: "Blog entry",
      },
    ]);

    upsertEntries(entries);

    const { entries: blogEntries, total } = queryEntries({ source: "blog" });
    expect(total).toBe(1);
    expect(blogEntries[0].title).toBe("Blog entry");
  });

  it("paginates correctly", () => {
    const entries = assignIds(
      Array.from({ length: 5 }, (_, i) => ({
        id: "",
        platform: "manual" as const,
        platformId: `entry-${i}`,
        date: `2026-01-0${i + 1}T00:00:00Z`,
        title: `Entry ${i}`,
      }))
    );

    upsertEntries(entries);

    const page1 = queryEntries({ page: 1, limit: 2 });
    expect(page1.entries.length).toBe(2);
    expect(page1.total).toBe(5);
    // Should be ordered by date DESC
    expect(page1.entries[0].title).toBe("Entry 4");

    const page2 = queryEntries({ page: 2, limit: 2 });
    expect(page2.entries.length).toBe(2);

    const page3 = queryEntries({ page: 3, limit: 2 });
    expect(page3.entries.length).toBe(1);
  });
});

describe("sync engine", () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    closeDb();
  });

  it("syncs manual adapter and writes to DB", async () => {
    const config: ChangelogConfig = {
      site: { title: "Test", description: "" },
      syncInterval: "0 */4 * * *",
      sources: [
        {
          adapter: "manual",
          directory: "./content/changelog",
        },
      ],
    };
    setConfig(config);

    const results = await syncAll(config);
    expect(results.length).toBe(1);
    expect(results[0].adapter).toBe("manual");
    expect(results[0].added).toBeGreaterThan(0);
    expect(results[0].errors.length).toBe(0);

    const { entries } = queryEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].platform).toBe("manual");
  });

  it("handles unknown adapters gracefully", async () => {
    const config: ChangelogConfig = {
      site: { title: "Test", description: "" },
      syncInterval: "0 */4 * * *",
      sources: [{ adapter: "nonexistent" }],
    };
    setConfig(config);

    const results = await syncAll(config);
    expect(results[0].errors.length).toBeGreaterThan(0);
    expect(results[0].errors[0]).toContain("Unknown adapter");
  });

  it("logs sync runs", async () => {
    const config: ChangelogConfig = {
      site: { title: "Test", description: "" },
      syncInterval: "0 */4 * * *",
      sources: [
        {
          adapter: "manual",
          directory: "./content/changelog",
        },
      ],
    };
    setConfig(config);

    await syncAll(config);

    const logs = getLatestSyncLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].adapter).toBe("manual");
    expect(logs[0].status).toBe("success");
  });
});
