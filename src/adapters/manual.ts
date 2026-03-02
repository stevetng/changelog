import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import matter from "gray-matter";
import type { Adapter, AdapterResult, ChangelogEntry } from "./types.ts";

export const manualAdapter: Adapter = {
  name: "manual",

  async fetch(config): Promise<AdapterResult> {
    const directory = resolve(config.directory as string ?? "./content/changelog");
    const tags = (config.tagAs as string[]) ?? [];
    const errors: string[] = [];
    const entries: ChangelogEntry[] = [];

    let files: string[];
    try {
      files = readdirSync(directory).filter((f) => f.endsWith(".md")).sort();
    } catch (err) {
      return {
        entries: [],
        errors: [`Could not read directory ${directory}: ${(err as Error).message}`],
      };
    }

    for (const file of files) {
      try {
        const filePath = join(directory, file);
        const raw = readFileSync(filePath, "utf-8");
        const { data, content } = matter(raw);

        if (!data.title || !data.date) {
          errors.push(`${file}: missing required frontmatter (title, date)`);
          continue;
        }

        const date =
          data.date instanceof Date ? data.date.toISOString() : String(data.date);

        const entryTags = [
          ...tags,
          ...((data.tags as string[]) ?? []),
        ];

        entries.push({
          id: "",
          platform: "manual",
          platformId: `manual:${file}`,
          date,
          title: String(data.title),
          body: content.trim() || undefined,
          url: data.url ? String(data.url) : undefined,
          tags: entryTags,
          media: data.media_url
            ? {
                type: (data.media_type as "image" | "video") ?? "image",
                url: String(data.media_url),
              }
            : undefined,
        });
      } catch (err) {
        errors.push(`${file}: ${(err as Error).message}`);
      }
    }

    return { entries, errors: errors.length > 0 ? errors : undefined };
  },
};
