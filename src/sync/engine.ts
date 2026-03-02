import type { ChangelogConfig } from "../config.ts";
import type { AdapterConfig, AdapterResult } from "../adapters/types.ts";
import { getAdapter } from "../adapters/registry.ts";
import { assignIds } from "./dedup.ts";
import {
  upsertEntries,
  deleteOldEntries,
  pruneToMaxEntries,
  createSyncLog,
  completeSyncLog,
} from "../db/client.ts";

interface SyncResult {
  adapter: string;
  added: number;
  updated: number;
  errors: string[];
}

function parseMaxAge(maxAge: string): Date | null {
  const match = maxAge.match(/^(\d+)(d|w|m|y)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const now = new Date();

  switch (unit) {
    case "d":
      now.setDate(now.getDate() - value);
      break;
    case "w":
      now.setDate(now.getDate() - value * 7);
      break;
    case "m":
      now.setMonth(now.getMonth() - value);
      break;
    case "y":
      now.setFullYear(now.getFullYear() - value);
      break;
  }

  return now;
}

async function runAdapterWithRetry(
  adapterName: string,
  config: AdapterConfig
): Promise<AdapterResult> {
  const adapter = getAdapter(adapterName);
  if (!adapter) {
    return { entries: [], errors: [`Unknown adapter: ${adapterName}`] };
  }

  try {
    return await adapter.fetch(config);
  } catch (err) {
    console.log(`[${adapterName}] First attempt failed, retrying in 5s...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      return await adapter.fetch(config);
    } catch (retryErr) {
      return {
        entries: [],
        errors: [`Adapter ${adapterName} failed after retry: ${(retryErr as Error).message}`],
      };
    }
  }
}

export async function syncAll(config: ChangelogConfig): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  const adapterTasks = config.sources.map(async (source): Promise<SyncResult> => {
    const adapterName = source.adapter;
    const logId = createSyncLog(adapterName);

    console.log(`[${adapterName}] Starting sync...`);

    const adapterResult = await runAdapterWithRetry(adapterName, source as AdapterConfig);

    if (adapterResult.errors?.length) {
      for (const error of adapterResult.errors) {
        console.log(`[${adapterName}] Error: ${error}`);
      }
    }

    const withIds = assignIds(adapterResult.entries);
    console.log(`[${adapterName}] Fetched ${withIds.length} entries`);

    let added = 0;
    let updated = 0;

    if (withIds.length > 0) {
      const upsertResult = upsertEntries(withIds);
      added = upsertResult.added;
      updated = upsertResult.updated;
      console.log(`[${adapterName}] Added: ${added}, Updated: ${updated}`);
    }

    const hasErrors = (adapterResult.errors?.length ?? 0) > 0;
    completeSyncLog(
      logId,
      hasErrors && withIds.length === 0 ? "error" : "success",
      added,
      updated,
      adapterResult.errors?.join("; ")
    );

    return {
      adapter: adapterName,
      added,
      updated,
      errors: adapterResult.errors ?? [],
    };
  });

  const settled = await Promise.allSettled(adapterTasks);

  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      results.push({
        adapter: "unknown",
        added: 0,
        updated: 0,
        errors: [result.reason?.message ?? "Unknown error"],
      });
    }
  }

  // Apply global filters
  if (config.filters?.maxAge) {
    const cutoff = parseMaxAge(config.filters.maxAge);
    if (cutoff) {
      const deleted = deleteOldEntries(cutoff.toISOString());
      if (deleted > 0) {
        console.log(`[sync] Pruned ${deleted} entries older than ${config.filters.maxAge}`);
      }
    }
  }

  if (config.filters?.maxEntries) {
    const pruned = pruneToMaxEntries(config.filters.maxEntries);
    if (pruned > 0) {
      console.log(`[sync] Pruned ${pruned} entries exceeding max of ${config.filters.maxEntries}`);
    }
  }

  return results;
}
