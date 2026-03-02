export interface ChangelogEntry {
  id: string;
  platform: Platform;
  platformId: string;
  date: string;
  title: string;
  body?: string;
  url?: string;
  tags?: string[];
  media?: {
    type: "image" | "video";
    url: string;
    alt?: string;
  };
  rawData?: unknown;
}

export type Platform =
  | "github"
  | "blog"
  | "twitter"
  | "mastodon"
  | "youtube"
  | "linkedin"
  | "newsletter"
  | "manual"
  | string;

export interface AdapterConfig {
  adapter: string;
  [key: string]: unknown;
}

export interface AdapterResult {
  entries: ChangelogEntry[];
  errors?: string[];
}

export interface Adapter {
  name: string;
  fetch(config: AdapterConfig): Promise<AdapterResult>;
}
