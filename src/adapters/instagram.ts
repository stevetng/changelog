import type { Adapter, AdapterResult, ChangelogEntry } from "./types.ts";

interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

interface InstagramMediaResponse {
  data?: InstagramMedia[];
  paging?: {
    cursors: { after: string };
    next?: string;
  };
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

function extractTitle(caption: string | undefined): string {
  if (!caption) return "Instagram post";
  const firstLine = caption.split("\n")[0].trim();
  return firstLine.length > 200 ? firstLine.slice(0, 197) + "..." : firstLine;
}

export const instagramAdapter: Adapter = {
  name: "instagram",

  async fetch(config): Promise<AdapterResult> {
    const token = config.token as string | undefined;

    if (!token) {
      return {
        entries: [],
        errors: [
          "Instagram adapter requires a 'token' config field (long-lived access token). " +
            "Generate one via the Instagram Graph API or Instagram Basic Display API.",
        ],
      };
    }

    const tags = (config.tagAs as string[]) ?? [];
    const maxResults = Math.min((config.maxResults as number) ?? 30, 100);

    try {
      const url = new URL("https://graph.instagram.com/me/media");
      url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp");
      url.searchParams.set("limit", String(maxResults));
      url.searchParams.set("access_token", token);

      const res = await fetch(url.toString());

      if (!res.ok) {
        const body = await res.text();
        return {
          entries: [],
          errors: [`Instagram API ${res.status}: ${body.slice(0, 300)}`],
        };
      }

      const data = (await res.json()) as InstagramMediaResponse;

      if (data.error) {
        return {
          entries: [],
          errors: [`Instagram API error: ${data.error.message}`],
        };
      }

      const posts = data.data ?? [];

      const entries: ChangelogEntry[] = posts.map((post) => {
        const isVideo = post.media_type === "VIDEO";

        return {
          id: "",
          platform: "instagram",
          platformId: `instagram:${post.id}`,
          date: post.timestamp,
          title: extractTitle(post.caption),
          body: post.caption ?? undefined,
          url: post.permalink,
          tags: [...tags],
          media: {
            type: isVideo ? ("video" as const) : ("image" as const),
            url: isVideo ? (post.thumbnail_url ?? post.media_url) : post.media_url,
          },
          rawData: post,
        };
      });

      return { entries };
    } catch (err) {
      return {
        entries: [],
        errors: [`Instagram adapter failed: ${(err as Error).message}`],
      };
    }
  },
};
