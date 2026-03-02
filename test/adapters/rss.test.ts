import { describe, it, expect, vi, afterEach } from "vitest";
import { rssAdapter } from "../../src/adapters/rss.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";

// Serve the fixture XML file on a local port for rss-parser
function createFixtureServer(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const xml = readFileSync(join(import.meta.dirname, "../fixtures/rss-feed.xml"), "utf-8");
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(xml);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}/feed.xml`,
        close: () => server.close(),
      });
    });
  });
}

describe("rss adapter", () => {
  let server: { url: string; close: () => void };

  afterEach(() => {
    server?.close();
    vi.restoreAllMocks();
  });

  it("returns error when url is missing", async () => {
    const result = await rssAdapter.fetch({ adapter: "rss" });
    expect(result.entries).toEqual([]);
    expect(result.errors![0]).toContain("url");
  });

  it("parses RSS feed and maps fields correctly", async () => {
    server = await createFixtureServer();
    const result = await rssAdapter.fetch({
      adapter: "rss",
      url: server.url,
      tagAs: ["writing"],
    });

    expect(result.entries.length).toBe(5);
    expect(result.entries[0].platform).toBe("blog");
    expect(result.entries[0].title).toBe("Building a Personal Changelog");
    expect(result.entries[0].url).toBe("https://testblog.com/posts/personal-changelog");
    expect(result.entries[0].tags).toContain("writing");
    expect(result.entries[0].date).toBeTruthy();
  });

  it("stores platformId from guid", async () => {
    server = await createFixtureServer();
    const result = await rssAdapter.fetch({
      adapter: "rss",
      url: server.url,
    });

    expect(result.entries[0].platformId).toBe(
      "https://testblog.com/posts/personal-changelog"
    );
  });

  it("handles unreachable URL gracefully", async () => {
    const result = await rssAdapter.fetch({
      adapter: "rss",
      url: "http://127.0.0.1:1/nonexistent",
    });

    expect(result.entries).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });
});
