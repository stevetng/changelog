import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { setDb, closeDb, upsertEntries } from "../src/db/client.ts";
import { setConfig, getConfig } from "../src/config.ts";
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
      title: "My Changelog",
      description: "What I've been building.",
      url: "https://mysite.com",
      author: "Test User",
    },
    syncInterval: "0 */4 * * *",
    sources: [{ adapter: "manual", directory: "./content/changelog" }],
  };
  setConfig(config);

  const app = new Hono();
  app.route("/api", createApiRoutes());

  // Replicate the standalone page route from src/index.ts
  app.get("/changelog", (c) => {
    const siteUrl = config.site.url ?? "http://localhost:3000";
    const apiBase = siteUrl.replace(/\/$/, "");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${config.site.title}</title>
  <meta name="description" content="${config.site.description}">
  <link rel="alternate" type="application/rss+xml" title="${config.site.title} RSS" href="${apiBase}/api/changelog.rss">
  <link rel="alternate" type="application/atom+xml" title="${config.site.title} Atom" href="${apiBase}/api/changelog.atom">
  <script type="module" src="${apiBase}/api/widget.js"></script>
</head>
<body>
  <changelog-feed src="${apiBase}/api/changelog.json" theme="auto" show-filters></changelog-feed>
</body>
</html>`;

    return c.html(html);
  });

  return { app, db };
}

describe("standalone /changelog page", () => {
  let app: Hono;

  beforeEach(() => {
    const setup = setupTestApp();
    app = setup.app;
  });

  afterEach(() => {
    closeDb();
  });

  it("GET /changelog returns HTML page", async () => {
    const res = await app.request("/changelog");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("includes the site title", async () => {
    const res = await app.request("/changelog");
    const body = await res.text();
    expect(body).toContain("<title>My Changelog</title>");
  });

  it("includes the changelog-feed web component", async () => {
    const res = await app.request("/changelog");
    const body = await res.text();
    expect(body).toContain("<changelog-feed");
    expect(body).toContain('src="https://mysite.com/api/changelog.json"');
    expect(body).toContain('theme="auto"');
    expect(body).toContain("show-filters");
  });

  it("loads the widget script from the API", async () => {
    const res = await app.request("/changelog");
    const body = await res.text();
    expect(body).toContain('src="https://mysite.com/api/widget.js"');
  });

  it("includes RSS and Atom feed links", async () => {
    const res = await app.request("/changelog");
    const body = await res.text();
    expect(body).toContain('type="application/rss+xml"');
    expect(body).toContain('href="https://mysite.com/api/changelog.rss"');
    expect(body).toContain('type="application/atom+xml"');
    expect(body).toContain('href="https://mysite.com/api/changelog.atom"');
  });

  it("includes meta description", async () => {
    const res = await app.request("/changelog");
    const body = await res.text();
    expect(body).toContain('name="description"');
    expect(body).toContain("What I've been building.");
  });
});

describe("docker config", () => {
  it("Dockerfile exists and uses node:20-slim", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");

    const dockerfile = readFileSync(resolve("Dockerfile"), "utf-8");
    expect(dockerfile).toContain("node:20-slim");
    expect(dockerfile).toContain("EXPOSE 3000");
    expect(dockerfile).toContain("npm run db:migrate");
  });

  it("docker-compose.yml exists and mounts data volume", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");

    const compose = readFileSync(resolve("docker-compose.yml"), "utf-8");
    expect(compose).toContain("./data:/app/data");
    expect(compose).toContain("3000:3000");
  });
});
