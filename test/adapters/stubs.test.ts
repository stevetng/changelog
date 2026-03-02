import { describe, it, expect } from "vitest";
import { linkedinAdapter } from "../../src/adapters/linkedin.ts";

describe("linkedin adapter (stub)", () => {
  it("returns empty entries with informational error", async () => {
    const result = await linkedinAdapter.fetch({ adapter: "linkedin" });
    expect(result.entries).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("not yet implemented");
  });
});
