import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Since Lit web components need a browser DOM, we test the component logic
// indirectly by testing the built output exists and the component's data
// processing behavior. Full DOM tests would use @web/test-runner.

describe("widget build", () => {
  it("produces a built JS file", async () => {
    const { existsSync, statSync } = await import("node:fs");
    const { resolve } = await import("node:path");

    const widgetPath = resolve("public/changelog-feed.js");
    expect(existsSync(widgetPath)).toBe(true);

    const stats = statSync(widgetPath);
    expect(stats.size).toBeGreaterThan(0);
    // Should be under 30KB unminified (well under 10KB gzipped)
    expect(stats.size).toBeLessThan(30_000);
  });

  it("built file contains the custom element definition", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");

    const js = readFileSync(resolve("public/changelog-feed.js"), "utf-8");
    expect(js).toContain("changelog-feed");
  });

  it("built file contains key CSS custom properties", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");

    const js = readFileSync(resolve("public/changelog-feed.js"), "utf-8");
    expect(js).toContain("--cl-font-mono");
    expect(js).toContain("--cl-accent");
    expect(js).toContain("--cl-bg");
  });

  it("built file contains shadow DOM styles for theming", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");

    const js = readFileSync(resolve("public/changelog-feed.js"), "utf-8");
    expect(js).toContain("prefers-color-scheme");
    // Dark theme variables
    expect(js).toContain("#1c1917");
    expect(js).toContain("#fafaf9");
  });
});

describe("widget API route", () => {
  it("GET /api/widget.js serves the built widget file", async () => {
    // Import route setup to test the endpoint
    const { Hono } = await import("hono");
    const Database = (await import("better-sqlite3")).default;
    const { readFileSync } = await import("node:fs");
    const { setDb, closeDb } = await import("../src/db/client.ts");
    const { setConfig } = await import("../src/config.ts");
    const { createApiRoutes } = await import("../src/api/routes.ts");

    const db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url).pathname, "utf-8");
    db.exec(schema);
    setDb(db);

    setConfig({
      site: { title: "Test", description: "" },
      syncInterval: "0 */4 * * *",
      sources: [{ adapter: "manual" }],
    });

    const app = new Hono();
    app.route("/api", createApiRoutes());

    try {
      const res = await app.request("/api/widget.js");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/javascript");

      const body = await res.text();
      expect(body).toContain("changelog-feed");
    } finally {
      closeDb();
    }
  });
});

describe("widget icons", () => {
  it("exports icons for all standard platforms", async () => {
    // We can test the icons module directly since it uses lit's svg tag function
    const { icons, getIcon } = await import("../src/widget/icons.ts");

    const platforms = ["github", "blog", "twitter", "mastodon", "youtube", "linkedin", "newsletter", "manual"];
    for (const platform of platforms) {
      expect(icons[platform]).toBeDefined();
    }

    // getIcon returns manual icon for unknown platforms
    const unknown = getIcon("unknown-platform");
    expect(unknown).toBeDefined();
    expect(unknown).toBe(icons.manual);
  });

  it("exports utility icons (arrow, clipboard, retry)", async () => {
    const { icons } = await import("../src/widget/icons.ts");

    expect(icons.arrow).toBeDefined();
    expect(icons.clipboard).toBeDefined();
    expect(icons.retry).toBeDefined();
  });
});
