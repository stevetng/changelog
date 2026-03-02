import type { Adapter } from "./types.ts";
import { manualAdapter } from "./manual.ts";
import { rssAdapter } from "./rss.ts";
import { githubAdapter } from "./github.ts";
import { mastodonAdapter } from "./mastodon.ts";
import { youtubeAdapter } from "./youtube.ts";
import { twitterAdapter } from "./twitter.ts";
import { linkedinAdapter } from "./linkedin.ts";
import { substackAdapter } from "./substack.ts";
import { instagramAdapter } from "./instagram.ts";

const adapters = new Map<string, Adapter>();

// Register built-in adapters
adapters.set("manual", manualAdapter);
adapters.set("rss", rssAdapter);
adapters.set("github", githubAdapter);
adapters.set("mastodon", mastodonAdapter);
adapters.set("youtube", youtubeAdapter);
adapters.set("twitter", twitterAdapter);
adapters.set("linkedin", linkedinAdapter);
adapters.set("substack", substackAdapter);
adapters.set("instagram", instagramAdapter);

export function getAdapter(name: string): Adapter | undefined {
  return adapters.get(name);
}

export function registerAdapter(adapter: Adapter): void {
  adapters.set(adapter.name, adapter);
}

export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}
