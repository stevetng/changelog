import { Hono } from "hono";
import { cors } from "hono/cors";
import { getConfig } from "../config.ts";
import { queryEntries, getLatestSyncLogs } from "../db/client.ts";
import { syncAll } from "../sync/engine.ts";

export function createApiRoutes(corsOrigins?: string[]): Hono {
  const api = new Hono();

  api.use(
    "/*",
    cors({
      origin: corsOrigins ?? "*",
      allowMethods: ["GET", "POST"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );

  // JSON feed
  api.get("/changelog.json", (c) => {
    const config = getConfig();
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const limit = parseInt(c.req.query("limit") ?? "20", 10);
    const tag = c.req.query("tag") ?? undefined;
    const source = c.req.query("source") ?? undefined;

    const { entries, total } = queryEntries({ page, limit, tag, source });

    return c.json({
      meta: {
        title: config.site.title,
        description: config.site.description,
        url: config.site.url,
        total,
        page,
        limit,
      },
      entries: entries.map((e) => ({
        id: e.id,
        platform: e.platform,
        date: e.date,
        title: e.title,
        body: e.body,
        url: e.url,
        tags: e.tags,
        media: e.media,
      })),
    });
  });

  // Manual sync trigger
  api.post("/sync", async (c) => {
    const apiKey = process.env.SYNC_API_KEY;
    if (apiKey) {
      const auth = c.req.header("Authorization");
      if (auth !== `Bearer ${apiKey}`) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    const config = getConfig();
    const results = await syncAll(config);
    return c.json({ results });
  });

  // Sync status
  api.get("/sync/status", (c) => {
    const logs = getLatestSyncLogs();
    return c.json({
      adapters: logs.map((log) => ({
        adapter: log.adapter,
        lastSync: log.finished_at ?? log.started_at,
        status: log.status,
        entriesAdded: log.entries_added,
        entriesUpdated: log.entries_updated,
        error: log.error_message,
      })),
    });
  });

  return api;
}
