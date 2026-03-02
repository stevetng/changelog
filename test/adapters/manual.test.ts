import { describe, it, expect } from "vitest";
import { manualAdapter } from "../../src/adapters/manual.ts";
import { join } from "node:path";

const fixturesDir = join(import.meta.dirname, "../fixtures/manual");

describe("manual adapter", () => {
  it("reads markdown files from the content directory", async () => {
    const result = await manualAdapter.fetch({
      adapter: "manual",
      directory: join(process.cwd(), "content/changelog"),
    });

    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries[0].platform).toBe("manual");
    expect(result.entries[0].title).toBe("Launched v2.0 of my portfolio site");
    expect(result.entries[0].tags).toContain("release");
    expect(result.entries[0].tags).toContain("personal");
    expect(result.entries[0].url).toBe("https://yoursite.com/blog/v2-launch");
    expect(result.entries[0].body).toContain("Complete redesign");
  });

  it("returns error for missing directory", async () => {
    const result = await manualAdapter.fetch({
      adapter: "manual",
      directory: "/nonexistent/path",
    });

    expect(result.entries).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("merges tagAs from config with frontmatter tags", async () => {
    const result = await manualAdapter.fetch({
      adapter: "manual",
      directory: join(process.cwd(), "content/changelog"),
      tagAs: ["manual-tag"],
    });

    expect(result.entries[0].tags).toContain("manual-tag");
    expect(result.entries[0].tags).toContain("release");
  });

  it("skips files with missing frontmatter", async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const tmpDir = join(process.cwd(), "test/fixtures/manual-tmp");
    mkdirSync(tmpDir, { recursive: true });

    writeFileSync(join(tmpDir, "bad.md"), "# No frontmatter\nJust content.");
    writeFileSync(
      join(tmpDir, "good.md"),
      '---\ntitle: "Good entry"\ndate: 2026-01-01\n---\nContent here.'
    );

    try {
      const result = await manualAdapter.fetch({
        adapter: "manual",
        directory: tmpDir,
      });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].title).toBe("Good entry");
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.includes("bad.md"))).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
