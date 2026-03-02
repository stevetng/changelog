import { describe, it, expect, vi, afterEach } from "vitest";
import { substackAdapter } from "../../src/adapters/substack.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";

function createFixtureServer(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const xml = readFileSync(join(import.meta.dirname, "../fixtures/substack-feed.xml"), "utf-8");
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(xml);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}/feed`,
        close: () => server.close(),
      });
    });
  });
}

describe("substack adapter", () => {
  let server: { url: string; close: () => void };

  afterEach(() => {
    server?.close();
    vi.restoreAllMocks();
  });

  it("returns error when neither publication nor url is provided", async () => {
    const result = await substackAdapter.fetch({ adapter: "substack" });
    expect(result.entries).toEqual([]);
    expect(result.errors![0]).toContain("publication");
  });

  it("parses Substack RSS feed and maps fields correctly", async () => {
    server = await createFixtureServer();
    const result = await substackAdapter.fetch({
      adapter: "substack",
      url: server.url,
      tagAs: ["reading"],
    });

    expect(result.entries.length).toBe(3);
    expect(result.entries[0].platform).toBe("newsletter");
    expect(result.entries[0].title).toBe("Why I Built a Personal Changelog");
    expect(result.entries[0].url).toBe("https://testwriter.substack.com/p/why-i-built-a-personal-changelog");
    expect(result.entries[0].tags).toContain("reading");
    expect(result.entries[0].tags).toContain("newsletter");
  });

  it("uses substack: prefix for platformId", async () => {
    server = await createFixtureServer();
    const result = await substackAdapter.fetch({
      adapter: "substack",
      url: server.url,
    });

    expect(result.entries[0].platformId).toContain("substack:");
  });

  it("handles unreachable URL gracefully", async () => {
    const result = await substackAdapter.fetch({
      adapter: "substack",
      url: "http://127.0.0.1:1/nonexistent",
    });

    expect(result.entries).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });
});
