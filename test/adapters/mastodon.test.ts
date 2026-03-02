import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mastodonAdapter } from "../../src/adapters/mastodon.ts";
import statusesFixture from "../fixtures/mastodon-statuses.json";

function mockFetch(accountId: string, statuses: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/v1/accounts/lookup")) {
        return { ok: true, json: async () => ({ id: accountId }) };
      }
      if (url.includes("/api/v1/accounts/")) {
        return { ok: true, json: async () => statuses };
      }
      return { ok: false, status: 404, statusText: "Not Found" };
    })
  );
}

describe("mastodon adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when instance or handle is missing", async () => {
    const result = await mastodonAdapter.fetch({ adapter: "mastodon" });
    expect(result.entries).toEqual([]);
    expect(result.errors![0]).toContain("instance");
  });

  it("fetches statuses and maps fields correctly", async () => {
    mockFetch("12345", statusesFixture);

    const result = await mastodonAdapter.fetch({
      adapter: "mastodon",
      instance: "mastodon.social",
      handle: "@testuser",
      tagAs: ["social"],
    });

    expect(result.entries.length).toBe(4);
    expect(result.entries[0].platform).toBe("mastodon");
    expect(result.entries[0].url).toBe("https://mastodon.social/@testuser/111001");
    expect(result.entries[0].tags).toContain("social");
    expect(result.entries[0].tags).toContain("shipped");
  });

  it("strips HTML from content", async () => {
    mockFetch("12345", statusesFixture);

    const result = await mastodonAdapter.fetch({
      adapter: "mastodon",
      instance: "mastodon.social",
      handle: "@testuser",
    });

    const post = result.entries[0];
    expect(post.body).not.toContain("<p>");
    expect(post.body).not.toContain("<a ");
    expect(post.body).toContain("shipped v2.0");
  });

  it("filters by visibility", async () => {
    mockFetch("12345", statusesFixture);

    const result = await mastodonAdapter.fetch({
      adapter: "mastodon",
      instance: "mastodon.social",
      handle: "@testuser",
      filter: { visibility: "public" },
    });

    // Fixture has 3 public, 1 unlisted
    expect(result.entries.length).toBe(3);
    expect(result.entries.every((e) => !e.platformId.includes("111004"))).toBe(true);
  });

  it("filters by hashtag", async () => {
    mockFetch("12345", statusesFixture);

    const result = await mastodonAdapter.fetch({
      adapter: "mastodon",
      instance: "mastodon.social",
      handle: "@testuser",
      filter: { visibility: "public", hashtags: ["shipped"] },
    });

    expect(result.entries.length).toBe(1);
    expect(result.entries[0].platformId).toContain("111001");
  });

  it("includes media attachments", async () => {
    mockFetch("12345", statusesFixture);

    const result = await mastodonAdapter.fetch({
      adapter: "mastodon",
      instance: "mastodon.social",
      handle: "@testuser",
    });

    const withMedia = result.entries.find((e) => e.media);
    expect(withMedia).toBeDefined();
    expect(withMedia!.media!.type).toBe("image");
    expect(withMedia!.media!.alt).toBe("Screenshot of the new portfolio design");
  });

  it("handles account lookup failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" })
    );

    const result = await mastodonAdapter.fetch({
      adapter: "mastodon",
      instance: "mastodon.social",
      handle: "@nonexistent",
    });

    expect(result.entries).toEqual([]);
    expect(result.errors![0]).toContain("Could not look up");
  });
});
