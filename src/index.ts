import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { loadConfig, setConfig } from "./config.ts";
import { migrate } from "./db/migrate.ts";
import { createApiRoutes } from "./api/routes.ts";
import { startScheduler } from "./sync/scheduler.ts";

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

  // Standalone changelog page
  app.get("/changelog", (c) => {
    const siteUrl = config.site.url ?? `http://localhost:${process.env.PORT ?? "3000"}`;
    const apiBase = siteUrl.replace(/\/$/, "");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.site.title}</title>
  <meta name="description" content="${config.site.description}">
  <link rel="alternate" type="application/rss+xml" title="${config.site.title} RSS" href="${apiBase}/api/changelog.rss">
  <link rel="alternate" type="application/atom+xml" title="${config.site.title} Atom" href="${apiBase}/api/changelog.atom">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 40px 20px;
      font-family: system-ui, -apple-system, sans-serif;
      background: #fafaf9;
      color: #1c1917;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #1c1917; color: #fafaf9; }
    }
    header {
      max-width: 640px;
      width: 100%;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 4px;
    }
    .description {
      font-size: 14px;
      color: #78716c;
      margin: 0;
    }
    @media (prefers-color-scheme: dark) {
      .description { color: #a8a29e; }
    }
    changelog-feed {
      width: 100%;
    }
  </style>
  <script type="module" src="${apiBase}/api/widget.js"></script>
</head>
<body>
  <header>
    <h1>${config.site.title}</h1>
    ${config.site.description ? `<p class="description">${config.site.description}</p>` : ""}
  </header>
  <changelog-feed
    src="${apiBase}/api/changelog.json"
    theme="auto"
    show-filters
  ></changelog-feed>
</body>
</html>`;

    return c.html(html);
  });

  // Health check
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Start periodic sync scheduler
  startScheduler(config);
}

await setup();

const port = parseInt(process.env.PORT ?? "3000", 10);
console.log(`[changelog] Server running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });

export default app;
