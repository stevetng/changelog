import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { loadConfig, setConfig } from "./config.ts";
import { migrate } from "./db/migrate.ts";
import { createApiRoutes } from "./api/routes.ts";

const app = new Hono();

async function setup() {
  const config = await loadConfig();
  setConfig(config);
  migrate();

  const corsOrigins = config.corsOrigins ?? (
    process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()) : undefined
  );

  const api = createApiRoutes(corsOrigins);
  app.route("/api", api);

  // Health check
  app.get("/health", (c) => c.json({ status: "ok" }));
}

await setup();

const port = parseInt(process.env.PORT ?? "3000", 10);
console.log(`[changelog] Server running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });

export default app;
