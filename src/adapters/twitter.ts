import type { Adapter, AdapterResult, ChangelogEntry } from "./types.ts";

interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  attachments?: {
    media_keys?: string[];
  };
}

interface TwitterMedia {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
}

interface TwitterUser {
  id: string;
  username: string;
  name: string;
}

interface TwitterTimelineResponse {
  data?: TwitterTweet[];
  includes?: {
    media?: TwitterMedia[];
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

interface TwitterUserLookupResponse {
  data?: TwitterUser;
  errors?: { detail: string }[];
}

function extractTitle(text: string): string {
  const firstLine = text.split("\n")[0].trim();
  return firstLine.length > 200 ? firstLine.slice(0, 197) + "..." : firstLine;
}

export const twitterAdapter: Adapter = {
  name: "twitter",

  async fetch(config): Promise<AdapterResult> {
    const bearerToken = config.token as string | undefined;
    const username = config.username as string | undefined;

    if (!bearerToken) {
      return {
        entries: [],
        errors: [
          "Twitter adapter requires a 'token' config field (Bearer Token). " +
            "You can get one from the Twitter Developer Portal (Basic plan or higher).",
        ],
      };
    }

    if (!username) {
      return {
        entries: [],
        errors: ["Twitter adapter requires a 'username' config field (e.g. 'elonmusk')."],
      };
    }

    const tags = (config.tagAs as string[]) ?? [];
    const maxResults = Math.min((config.maxResults as number) ?? 30, 100);
    const excludeReplies = (config.excludeReplies as boolean) ?? true;
    const excludeRetweets = (config.excludeRetweets as boolean) ?? true;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${bearerToken}`,
    };

    try {
      // Step 1: Look up user ID by username
      const userRes = await fetch(
        `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username.replace(/^@/, ""))}`,
        { headers }
      );

      if (!userRes.ok) {
        const body = await userRes.text();
        return {
          entries: [],
          errors: [`Twitter user lookup failed (${userRes.status}): ${body.slice(0, 300)}`],
        };
      }

      const userData = (await userRes.json()) as TwitterUserLookupResponse;

      if (!userData.data) {
        return {
          entries: [],
          errors: [
            `Could not find Twitter user @${username}. ` +
              (userData.errors?.[0]?.detail ?? "Check the username and try again."),
          ],
        };
      }

      const userId = userData.data.id;

      // Step 2: Fetch user tweets
      const exclude: string[] = [];
      if (excludeReplies) exclude.push("replies");
      if (excludeRetweets) exclude.push("retweets");

      const timelineUrl = new URL(`https://api.twitter.com/2/users/${userId}/tweets`);
      timelineUrl.searchParams.set("max_results", String(maxResults));
      timelineUrl.searchParams.set(
        "tweet.fields",
        "created_at,public_metrics,attachments"
      );
      timelineUrl.searchParams.set("expansions", "attachments.media_keys");
      timelineUrl.searchParams.set("media.fields", "type,url,preview_image_url");

      if (exclude.length > 0) {
        timelineUrl.searchParams.set("exclude", exclude.join(","));
      }

      const tweetsRes = await fetch(timelineUrl.toString(), { headers });

      if (!tweetsRes.ok) {
        const body = await tweetsRes.text();
        return {
          entries: [],
          errors: [`Twitter timeline fetch failed (${tweetsRes.status}): ${body.slice(0, 300)}`],
        };
      }

      const tweetsData = (await tweetsRes.json()) as TwitterTimelineResponse;
      const tweets = tweetsData.data ?? [];
      const mediaMap = new Map<string, TwitterMedia>();

      if (tweetsData.includes?.media) {
        for (const m of tweetsData.includes.media) {
          mediaMap.set(m.media_key, m);
        }
      }

      const cleanUsername = username.replace(/^@/, "");

      const entries: ChangelogEntry[] = tweets.map((tweet) => {
        const firstMediaKey = tweet.attachments?.media_keys?.[0];
        const media = firstMediaKey ? mediaMap.get(firstMediaKey) : undefined;

        return {
          id: "",
          platform: "twitter",
          platformId: `twitter:${tweet.id}`,
          date: tweet.created_at,
          title: extractTitle(tweet.text),
          body: tweet.text,
          url: `https://x.com/${cleanUsername}/status/${tweet.id}`,
          tags: [...tags],
          media: media
            ? {
                type: media.type === "photo" ? ("image" as const) : ("video" as const),
                url: media.url ?? media.preview_image_url ?? "",
                alt: undefined,
              }
            : undefined,
          rawData: tweet,
        };
      });

      return { entries };
    } catch (err) {
      return {
        entries: [],
        errors: [`Twitter adapter failed: ${(err as Error).message}`],
      };
    }
  },
};
