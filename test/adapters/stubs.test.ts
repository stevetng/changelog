import { describe, it, expect } from "vitest";
import { twitterAdapter } from "../../src/adapters/twitter.ts";
import { linkedinAdapter } from "../../src/adapters/linkedin.ts";

describe("twitter adapter (stub)", () => {
  it("returns empty entries with informational error", async () => {
    const result = await twitterAdapter.fetch({ adapter: "twitter" });
    expect(result.entries).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("not yet implemented");
  });
});

describe("linkedin adapter (stub)", () => {
  it("returns empty entries with informational error", async () => {
    const result = await linkedinAdapter.fetch({ adapter: "linkedin" });
    expect(result.entries).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("not yet implemented");
  });
});
