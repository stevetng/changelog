import { describe, it, expect, vi, afterEach } from "vitest";
import { instagramAdapter } from "../../src/adapters/instagram.ts";
import mediaFixture from "../fixtures/instagram-media.json";

function mockFetch(response: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    })
  );
}

describe("instagram adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when token is missing", async () => {
    const result = await instagramAdapter.fetch({ adapter: "instagram" });
    expect(result.entries).toEqual([]);
    expect(result.errors![0]).toContain("token");
  });

  it("fetches posts and maps fields correctly", async () => {
    mockFetch(mediaFixture);

    const result = await instagramAdapter.fetch({
      adapter: "instagram",
      token: "ig_token_abc",
      tagAs: ["social"],
    });

    expect(result.entries.length).toBe(3);
    expect(result.entries[0].platform).toBe("instagram");
    expect(result.entries[0].platformId).toBe("instagram:17900000000000001");
    expect(result.entries[0].title).toContain("New portfolio site");
    expect(result.entries[0].url).toBe("https://www.instagram.com/p/ABC001/");
    expect(result.entries[0].tags).toContain("social");
  });

  it("extracts caption as body", async () => {
    mockFetch(mediaFixture);

    const result = await instagramAdapter.fetch({
      adapter: "instagram",
      token: "ig_token_abc",
    });

    expect(result.entries[0].body).toContain("#webdev");
    expect(result.entries[1].body).toContain("SQLite");
  });

  it("maps media types correctly", async () => {
    mockFetch(mediaFixture);

    const result = await instagramAdapter.fetch({
      adapter: "instagram",
      token: "ig_token_abc",
    });

    // IMAGE
    expect(result.entries[0].media!.type).toBe("image");
    expect(result.entries[0].media!.url).toContain("portfolio-preview.jpg");

    // CAROUSEL_ALBUM mapped to image
    expect(result.entries[1].media!.type).toBe("image");

    // VIDEO uses thumbnail_url
    expect(result.entries[2].media!.type).toBe("video");
    expect(result.entries[2].media!.url).toContain("demo-thumb.jpg");
  });

  it("handles API error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Invalid token",
      })
    );

    const result = await instagramAdapter.fetch({
      adapter: "instagram",
      token: "bad_token",
    });

    expect(result.entries).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("400");
  });

  it("handles empty media response", async () => {
    mockFetch({ data: [] });

    const result = await instagramAdapter.fetch({
      adapter: "instagram",
      token: "ig_token_abc",
    });

    expect(result.entries).toEqual([]);
    expect(result.errors).toBeUndefined();
  });
});
