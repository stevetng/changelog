import type { Adapter, AdapterResult, ChangelogEntry } from "./types.ts";

interface MastodonStatus {
  id: string;
  created_at: string;
  content: string;
  url: string;
  visibility: string;
  tags: { name: string }[];
  media_attachments: {
    type: string;
    url: string;
    description: string | null;
  }[];
  spoiler_text: string;
}

interface MastodonAccount {
  id: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTitle(text: string): string {
  const firstLine = text.split("\n")[0].trim();
  return firstLine.length > 200 ? firstLine.slice(0, 197) + "..." : firstLine;
}

export const mastodonAdapter: Adapter = {
  name: "mastodon",

  async fetch(config): Promise<AdapterResult> {
    const instance = config.instance as string;
    const handle = config.handle as string;
    const token = config.token as string | undefined;

    if (!instance || !handle) {
      return {
        entries: [],
        errors: ["Mastodon adapter requires 'instance' and 'handle' config fields"],
      };
    }

    const tags = (config.tagAs as string[]) ?? [];
    const filter = config.filter as { visibility?: string; hashtags?: string[] } | undefined;

    const baseUrl = `https://${instance}`;
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      // Look up account ID by handle
      const cleanHandle = handle.replace(/^@/, "");
      const lookupRes = await fetch(
        `${baseUrl}/api/v1/accounts/lookup?acct=${encodeURIComponent(cleanHandle)}`,
        { headers }
      );

      if (!lookupRes.ok) {
        return {
          entries: [],
          errors: [`Could not look up Mastodon account ${handle}: ${lookupRes.status} ${lookupRes.statusText}`],
        };
      }

      const account = (await lookupRes.json()) as MastodonAccount;

      // Fetch statuses
      const statusesRes = await fetch(
        `${baseUrl}/api/v1/accounts/${account.id}/statuses?limit=40&exclude_replies=true&exclude_reblogs=true`,
        { headers }
      );

      if (!statusesRes.ok) {
        return {
          entries: [],
          errors: [`Failed to fetch statuses: ${statusesRes.status} ${statusesRes.statusText}`],
        };
      }

      const statuses = (await statusesRes.json()) as MastodonStatus[];

      const entries: ChangelogEntry[] = [];

      for (const status of statuses) {
        // Filter by visibility
        if (filter?.visibility && status.visibility !== filter.visibility) {
          continue;
        }

        // Filter by hashtags
        if (filter?.hashtags?.length) {
          const statusTagNames = status.tags.map((t) => t.name.toLowerCase());
          const hasMatch = filter.hashtags.some((h) =>
            statusTagNames.includes(h.toLowerCase().replace(/^#/, ""))
          );
          if (!hasMatch) continue;
        }

        const plainText = stripHtml(status.content);
        const media = status.media_attachments[0];

        entries.push({
          id: "",
          platform: "mastodon",
          platformId: `mastodon:${instance}:${status.id}`,
          date: status.created_at,
          title: status.spoiler_text || extractTitle(plainText),
          body: plainText,
          url: status.url,
          tags: [
            ...tags,
            ...status.tags.map((t) => t.name),
          ],
          media: media
            ? {
                type: media.type === "video" ? "video" : "image",
                url: media.url,
                alt: media.description ?? undefined,
              }
            : undefined,
          rawData: status,
        });
      }

      return { entries };
    } catch (err) {
      return {
        entries: [],
        errors: [`Mastodon adapter failed: ${(err as Error).message}`],
      };
    }
  },
};
