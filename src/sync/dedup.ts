import { createHash } from "node:crypto";
import type { ChangelogEntry } from "../adapters/types.ts";

export function computeEntryId(platform: string, platformId: string): string {
  return createHash("sha256").update(`${platform}:${platformId}`).digest("hex");
}

export function assignIds(entries: ChangelogEntry[]): ChangelogEntry[] {
  return entries.map((entry) => ({
    ...entry,
    id: computeEntryId(entry.platform, entry.platformId),
  }));
}
