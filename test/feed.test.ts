import { describe, it, expect } from "vitest";
import { generateRss, generateAtom } from "../src/api/feed.ts";
import type { ChangelogEntry } from "../src/adapters/types.ts";
import type { ChangelogConfig } from "../src/config.ts";

const config: ChangelogConfig = {
  site: {
    title: "Test Changelog",
    description: "Test description & more",
    url: "https://test.com",
    author: "Test Author",
  },
  syncInterval: "0 */4 * * *",
  sources: [{ adapter: "manual" }],
};

const entries: ChangelogEntry[] = [
  {
    id: "abc123",
    platform: "manual",
    platformId: "entry-1",
    date: "2026-03-01T12:00:00Z",
    title: "First Entry",
    body: "Some content here.",
    url: "https://test.com/post/1",
    tags: ["release", "code"],
  },
  {
    id: "def456",
    platform: "blog",
    platformId: "entry-2",
    date: "2026-02-15T10:00:00Z",
    title: 'Entry with "quotes" & <special> chars',
    tags: ["writing"],
  },
];

describe("RSS feed generation", () => {
  it("generates valid RSS XML", () => {
    const rss = generateRss(entries, config);

    expect(rss).toContain('<?xml version="1.0"');
    expect(rss).toContain("<rss version");
    expect(rss).toContain("<channel>");
    expect(rss).toContain("<title>Test Changelog</title>");
    expect(rss).toContain("Test description &amp; more");
  });

  it("includes all entries as items", () => {
    const rss = generateRss(entries, config);

    expect(rss).toContain("<title>First Entry</title>");
    expect(rss).toContain("<guid isPermaLink=\"false\">abc123</guid>");
    expect(rss).toContain("<link>https://test.com/post/1</link>");
    expect(rss).toContain("<category>release</category>");
    expect(rss).toContain("<category>code</category>");
  });

  it("escapes XML special characters", () => {
    const rss = generateRss(entries, config);

    expect(rss).toContain("&quot;quotes&quot;");
    expect(rss).toContain("&lt;special&gt;");
    expect(rss).toContain("&amp;");
  });
});

describe("Atom feed generation", () => {
  it("generates valid Atom XML", () => {
    const atom = generateAtom(entries, config);

    expect(atom).toContain('<?xml version="1.0"');
    expect(atom).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(atom).toContain("<title>Test Changelog</title>");
    expect(atom).toContain("<author><name>Test Author</name></author>");
  });

  it("includes all entries", () => {
    const atom = generateAtom(entries, config);

    expect(atom).toContain("<title>First Entry</title>");
    expect(atom).toContain("urn:changelog:abc123");
    expect(atom).toContain('<category term="release"/>');
  });

  it("escapes XML special characters", () => {
    const atom = generateAtom(entries, config);

    expect(atom).toContain("&quot;quotes&quot;");
    expect(atom).toContain("&amp;");
  });
});
