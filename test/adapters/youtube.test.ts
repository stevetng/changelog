import { describe, it, expect, vi, afterEach } from "vitest";
import { youtubeAdapter } from "../../src/adapters/youtube.ts";
import searchFixture from "../fixtures/youtube-search.json";

describe("youtube adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when channelId or apiKey is missing", async () => {
    const result = await youtubeAdapter.fetch({ adapter: "youtube" });
    expect(result.entries).toEqual([]);
    expect(result.errors![0]).toContain("channelId");
  });

  it("fetches videos and maps fields correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => searchFixture,
      })
    );

    const result = await youtubeAdapter.fetch({
      adapter: "youtube",
      channelId: "UCtest123",
      apiKey: "test-key",
      tagAs: ["content"],
    });

    expect(result.entries.length).toBe(3);

    const first = result.entries[0];
    expect(first.platform).toBe("youtube");
    expect(first.platformId).toBe("youtube:abc123");
    expect(first.title).toBe("Building a Changelog Widget with Lit");
    expect(first.url).toBe("https://www.youtube.com/watch?v=abc123");
    expect(first.tags).toContain("content");
    expect(first.tags).toContain("video");
    expect(first.media).toBeDefined();
    expect(first.media!.type).toBe("video");
    expect(first.media!.url).toContain("hqdefault");
  });

  it("handles empty description", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => searchFixture,
      })
    );

    const result = await youtubeAdapter.fetch({
      adapter: "youtube",
      channelId: "UCtest123",
      apiKey: "test-key",
    });

    const noDesc = result.entries.find((e) => e.platformId === "youtube:ghi789");
    expect(noDesc!.body).toBeUndefined();
  });

  it("handles API error gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => '{"error": "quotaExceeded"}',
      })
    );

    const result = await youtubeAdapter.fetch({
      adapter: "youtube",
      channelId: "UCtest123",
      apiKey: "bad-key",
    });

    expect(result.entries).toEqual([]);
    expect(result.errors![0]).toContain("403");
  });

  it("passes correct query params to YouTube API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await youtubeAdapter.fetch({
      adapter: "youtube",
      channelId: "UCtest123",
      apiKey: "test-key",
      maxResults: 10,
    });

    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get("channelId")).toBe("UCtest123");
    expect(calledUrl.searchParams.get("key")).toBe("test-key");
    expect(calledUrl.searchParams.get("type")).toBe("video");
    expect(calledUrl.searchParams.get("maxResults")).toBe("10");
  });
});
