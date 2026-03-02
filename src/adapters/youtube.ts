import type { Adapter, AdapterResult, ChangelogEntry } from "./types.ts";

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
  nextPageToken?: string;
}

export const youtubeAdapter: Adapter = {
  name: "youtube",

  async fetch(config): Promise<AdapterResult> {
    const channelId = config.channelId as string;
    const apiKey = config.apiKey as string;

    if (!channelId || !apiKey) {
      return {
        entries: [],
        errors: ["YouTube adapter requires 'channelId' and 'apiKey' config fields"],
      };
    }

    const tags = (config.tagAs as string[]) ?? [];
    const maxResults = Math.min((config.maxResults as number) ?? 25, 50);

    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("key", apiKey);
      url.searchParams.set("channelId", channelId);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("order", "date");
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", String(maxResults));

      const res = await fetch(url.toString());

      if (!res.ok) {
        const body = await res.text();
        return {
          entries: [],
          errors: [`YouTube API ${res.status}: ${body.slice(0, 200)}`],
        };
      }

      const data = (await res.json()) as YouTubeSearchResponse;

      const entries: ChangelogEntry[] = (data.items ?? []).map((item) => {
        const thumb =
          item.snippet.thumbnails.high ??
          item.snippet.thumbnails.medium ??
          item.snippet.thumbnails.default;

        return {
          id: "",
          platform: "youtube",
          platformId: `youtube:${item.id.videoId}`,
          date: item.snippet.publishedAt,
          title: item.snippet.title.slice(0, 200),
          body: item.snippet.description || undefined,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          tags: [...tags, "video"],
          media: thumb
            ? { type: "video" as const, url: thumb.url }
            : undefined,
          rawData: item,
        };
      });

      return { entries };
    } catch (err) {
      return {
        entries: [],
        errors: [`YouTube adapter failed: ${(err as Error).message}`],
      };
    }
  },
};
