import { describe, it, expect, vi, afterEach } from "vitest";
import { twitterAdapter } from "../../src/adapters/twitter.ts";
import tweetsFixture from "../fixtures/twitter-tweets.json";

const userLookupResponse = { data: { id: "99999", username: "testuser", name: "Test User" } };

function mockFetch(tweetsResponse: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/2/users/by/username/")) {
        return { ok: true, json: async () => userLookupResponse };
      }
      if (url.includes("/2/users/")) {
        return { ok: true, json: async () => tweetsResponse };
      }
      return { ok: false, status: 404, statusText: "Not Found" };
    })
  );
}

describe("twitter adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when token is missing", async () => {
    const result = await twitterAdapter.fetch({ adapter: "twitter", username: "testuser" });
    expect(result.entries).toEqual([]);
    expect(result.errors![0]).toContain("token");
  });

  it("returns error when username is missing", async () => {
    const result = await twitterAdapter.fetch({ adapter: "twitter", token: "bearer_abc" });
    expect(result.entries).toEqual([]);
    expect(result.errors![0]).toContain("username");
  });

  it("fetches tweets and maps fields correctly", async () => {
    mockFetch(tweetsFixture);

    const result = await twitterAdapter.fetch({
      adapter: "twitter",
      token: "bearer_abc",
      username: "testuser",
      tagAs: ["social"],
    });

    expect(result.entries.length).toBe(3);
    expect(result.entries[0].platform).toBe("twitter");
    expect(result.entries[0].platformId).toBe("twitter:1800000000000000001");
    expect(result.entries[0].date).toBe("2026-03-01T18:00:00.000Z");
    expect(result.entries[0].title).toContain("changelog aggregator widget");
    expect(result.entries[0].url).toBe("https://x.com/testuser/status/1800000000000000001");
    expect(result.entries[0].tags).toContain("social");
  });

  it("includes media from tweet attachments", async () => {
    mockFetch(tweetsFixture);

    const result = await twitterAdapter.fetch({
      adapter: "twitter",
      token: "bearer_abc",
      username: "testuser",
    });

    const withMedia = result.entries.find((e) => e.media);
    expect(withMedia).toBeDefined();
    expect(withMedia!.media!.type).toBe("image");
    expect(withMedia!.media!.url).toContain("changelog-widget-preview.jpg");
  });

  it("preserves full tweet text in body", async () => {
    mockFetch(tweetsFixture);

    const result = await twitterAdapter.fetch({
      adapter: "twitter",
      token: "bearer_abc",
      username: "testuser",
    });

    const multiline = result.entries[1];
    expect(multiline.body).toContain("dark mode");
    expect(multiline.body).toContain("filter chips");
  });

  it("handles user lookup failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "Unauthorized" })
    );

    const result = await twitterAdapter.fetch({
      adapter: "twitter",
      token: "bad_token",
      username: "testuser",
    });

    expect(result.entries).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("401");
  });

  it("strips leading @ from username", async () => {
    mockFetch(tweetsFixture);

    const result = await twitterAdapter.fetch({
      adapter: "twitter",
      token: "bearer_abc",
      username: "@testuser",
    });

    expect(result.entries.length).toBe(3);
    expect(result.entries[0].url).toContain("testuser/status/");
  });
});
