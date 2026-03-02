import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { setDb, closeDb, upsertEntries } from "../src/db/client.ts";
import { setConfig } from "../src/config.ts";
import { createApiRoutes } from "../src/api/routes.ts";
import { assignIds } from "../src/sync/dedup.ts";
import type { ChangelogConfig } from "../src/config.ts";

function setupTestApp() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url).pathname, "utf-8");
  db.exec(schema);
  setDb(db);

  const config: ChangelogConfig = {
    site: {
      title: "Test Changelog",
      description: "Test description",
      url: "https://test.com",
    },
    syncInterval: "0 */4 * * *",
    sources: [{ adapter: "manual", directory: "./content/changelog" }],
  };
  setConfig(config);

  const app = new Hono();
  app.route("/api", createApiRoutes());
  return { app, db };
}

function seedEntries() {
  const entries = assignIds([
    {
      id: "",
      platform: "manual",
      platformId: "entry-1",
      date: "2026-03-01T00:00:00Z",
      title: "First entry",
      body: "Body text",
      url: "https://example.com/1",
      tags: ["release", "code"],
    },
    {
      id: "",
      platform: "blog",
      platformId: "entry-2",
      date: "2026-02-15T00:00:00Z",
      title: "Blog post",
      tags: ["writing"],
    },
    {
      id: "",
      platform: "manual",
      platformId: "entry-3",
      date: "2026-02-01T00:00:00Z",
      title: "Second manual entry",
      tags: ["code"],
    },
  ]);
  upsertEntries(entries);
}

describe("API routes", () => {
  let app: Hono;

  beforeEach(() => {
    const setup = setupTestApp();
    app = setup.app;
    seedEntries();
  });

  afterEach(() => {
    closeDb();
  });

  it("GET /api/changelog.json returns entries", async () => {
    const res = await app.request("/api/changelog.json");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.meta.title).toBe("Test Changelog");
    expect(body.meta.total).toBe(3);
    expect(body.entries.length).toBe(3);
    // Ordered by date DESC
    expect(body.entries[0].title).toBe("First entry");
  });

  it("supports pagination", async () => {
    const res = await app.request("/api/changelog.json?page=1&limit=2");
    const body = await res.json();

    expect(body.meta.total).toBe(3);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(2);
    expect(body.entries.length).toBe(2);
  });

  it("filters by tag", async () => {
    const res = await app.request("/api/changelog.json?tag=writing");
    const body = await res.json();

    expect(body.meta.total).toBe(1);
    expect(body.entries[0].title).toBe("Blog post");
  });

  it("filters by source", async () => {
    const res = await app.request("/api/changelog.json?source=blog");
    const body = await res.json();

    expect(body.meta.total).toBe(1);
    expect(body.entries[0].platform).toBe("blog");
  });

  it("combines tag and source filters", async () => {
    const res = await app.request("/api/changelog.json?source=manual&tag=code");
    const body = await res.json();

    expect(body.meta.total).toBe(2);
    for (const entry of body.entries) {
      expect(entry.platform).toBe("manual");
      expect(entry.tags).toContain("code");
    }
  });

  it("returns CORS headers on preflight", async () => {
    const res = await app.request("/api/changelog.json", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });

  it("GET /api/sync/status returns sync logs", async () => {
    const res = await app.request("/api/sync/status");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.adapters).toBeDefined();
    expect(Array.isArray(body.adapters)).toBe(true);
  });

  it("POST /api/sync requires auth when SYNC_API_KEY is set", async () => {
    const originalKey = process.env.SYNC_API_KEY;
    process.env.SYNC_API_KEY = "test-secret";

    try {
      const res = await app.request("/api/sync", { method: "POST" });
      expect(res.status).toBe(401);

      const authRes = await app.request("/api/sync", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      });
      expect(authRes.status).toBe(200);
    } finally {
      if (originalKey === undefined) {
        delete process.env.SYNC_API_KEY;
      } else {
        process.env.SYNC_API_KEY = originalKey;
      }
    }
  });

  it("JSON shape matches spec", async () => {
    const res = await app.request("/api/changelog.json");
    const body = await res.json();

    // meta fields
    expect(body.meta).toHaveProperty("title");
    expect(body.meta).toHaveProperty("description");
    expect(body.meta).toHaveProperty("url");
    expect(body.meta).toHaveProperty("total");
    expect(body.meta).toHaveProperty("page");
    expect(body.meta).toHaveProperty("limit");

    // entry fields
    const entry = body.entries[0];
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("platform");
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("title");
    expect(entry).toHaveProperty("tags");
    // Should not expose rawData
    expect(entry).not.toHaveProperty("rawData");
    expect(entry).not.toHaveProperty("platformId");
  });
});
