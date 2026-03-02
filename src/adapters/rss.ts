import Parser from "rss-parser";
import type { Adapter, AdapterResult, ChangelogEntry } from "./types.ts";

export const rssAdapter: Adapter = {
  name: "rss",

  async fetch(config): Promise<AdapterResult> {
    const url = config.url as string;
    if (!url) {
      return { entries: [], errors: ["RSS adapter requires a 'url' config field"] };
    }

    const tags = (config.tagAs as string[]) ?? [];
    const errors: string[] = [];

    try {
      const parser = new Parser();
      const feed = await parser.parseURL(url);

      const entries: ChangelogEntry[] = (feed.items ?? []).map((item) => ({
        id: "",
        platform: "blog",
        platformId: item.guid ?? item.link ?? item.title ?? "",
        date: item.isoDate ?? new Date().toISOString(),
        title: (item.title ?? "Untitled").slice(0, 200),
        body: item.contentSnippet ?? undefined,
        url: item.link ?? undefined,
        tags,
        media: item.enclosure?.url
          ? {
              type: (item.enclosure.type?.startsWith("video") ? "video" : "image") as "image" | "video",
              url: item.enclosure.url,
            }
          : undefined,
        rawData: item,
      }));

      return { entries, errors: errors.length > 0 ? errors : undefined };
    } catch (err) {
      return {
        entries: [],
        errors: [`Failed to fetch or parse RSS feed at ${url}: ${(err as Error).message}`],
      };
    }
  },
};
