import Parser from "rss-parser";
import type { Adapter, AdapterResult, ChangelogEntry } from "./types.ts";

export const substackAdapter: Adapter = {
  name: "substack",

  async fetch(config): Promise<AdapterResult> {
    const publication = config.publication as string | undefined;
    const url = config.url as string | undefined;

    // Allow either a publication name (e.g. "mattlevine") or a full feed URL
    const feedUrl = url ?? (publication ? `https://${publication}.substack.com/feed` : undefined);

    if (!feedUrl) {
      return {
        entries: [],
        errors: [
          "Substack adapter requires either a 'publication' field (e.g. 'mattlevine') " +
            "or a full 'url' field pointing to the Substack RSS feed.",
        ],
      };
    }

    const tags = (config.tagAs as string[]) ?? [];

    try {
      const parser = new Parser();
      const feed = await parser.parseURL(feedUrl);

      const entries: ChangelogEntry[] = (feed.items ?? []).map((item) => ({
        id: "",
        platform: "newsletter",
        platformId: `substack:${item.guid ?? item.link ?? item.title ?? ""}`,
        date: item.isoDate ?? new Date().toISOString(),
        title: (item.title ?? "Untitled").slice(0, 200),
        body: item.contentSnippet?.slice(0, 2000) ?? undefined,
        url: item.link ?? undefined,
        tags: [...tags, "newsletter"],
        media: item.enclosure?.url
          ? {
              type: (item.enclosure.type?.startsWith("video") ? "video" : "image") as "image" | "video",
              url: item.enclosure.url,
            }
          : undefined,
        rawData: item,
      }));

      return { entries };
    } catch (err) {
      return {
        entries: [],
        errors: [`Failed to fetch Substack feed at ${feedUrl}: ${(err as Error).message}`],
      };
    }
  },
};
