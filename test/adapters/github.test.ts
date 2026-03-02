import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { githubAdapter } from "../../src/adapters/github.ts";
import releasesFixture from "../fixtures/github-releases.json";

describe("github adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => releasesFixture,
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when repos is missing", async () => {
    const result = await githubAdapter.fetch({ adapter: "github" });
    expect(result.entries).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("repos");
  });

  it("fetches releases and maps fields correctly", async () => {
    const result = await githubAdapter.fetch({
      adapter: "github",
      repos: ["testuser/myproject"],
      include: "releases",
      tagAs: ["code"],
    });

    // Should skip drafts (fixture has 4 entries, 1 is draft)
    expect(result.entries.length).toBe(3);

    const first = result.entries.find((e) => e.platformId.includes("1001"));
    expect(first).toBeDefined();
    expect(first!.platform).toBe("github");
    expect(first!.title).toContain("Version 2.0.0");
    expect(first!.title).toContain("testuser/myproject");
    expect(first!.url).toBe("https://github.com/testuser/myproject/releases/tag/v2.0.0");
    expect(first!.tags).toContain("code");
    expect(first!.tags).toContain("release");
  });

  it("tags prerelease entries", async () => {
    const result = await githubAdapter.fetch({
      adapter: "github",
      repos: ["testuser/myproject"],
      include: "releases",
    });

    const prerelease = result.entries.find((e) => e.platformId.includes("1002"));
    expect(prerelease!.tags).toContain("prerelease");
  });

  it("uses tag_name when release name is empty", async () => {
    const result = await githubAdapter.fetch({
      adapter: "github",
      repos: ["testuser/myproject"],
      include: "releases",
    });

    const noName = result.entries.find((e) => e.platformId.includes("1003"));
    expect(noName!.title).toContain("v1.9.0");
  });

  it("handles API errors gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      })
    );

    const result = await githubAdapter.fetch({
      adapter: "github",
      repos: ["testuser/myproject"],
      include: "releases",
    });

    expect(result.entries).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("403");
  });

  it("fetches commits when include is 'commits'", async () => {
    const commitFixture = [
      {
        sha: "abc123def456",
        commit: {
          message: "feat: add dark mode support\n\nImplements system and manual theme switching.",
          author: { date: "2026-03-01T12:00:00Z" },
        },
        html_url: "https://github.com/testuser/myproject/commit/abc123def456",
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => commitFixture,
      })
    );

    const result = await githubAdapter.fetch({
      adapter: "github",
      repos: ["testuser/myproject"],
      include: "commits",
      tagAs: ["code"],
    });

    expect(result.entries.length).toBe(1);
    expect(result.entries[0].title).toContain("feat: add dark mode support");
    expect(result.entries[0].body).toContain("Implements system");
    expect(result.entries[0].tags).toContain("commit");
  });
});
