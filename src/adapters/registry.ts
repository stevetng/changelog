import type { Adapter } from "./types.ts";
import { manualAdapter } from "./manual.ts";

const adapters = new Map<string, Adapter>();

// Register built-in adapters
adapters.set("manual", manualAdapter);

export function getAdapter(name: string): Adapter | undefined {
  return adapters.get(name);
}

export function registerAdapter(adapter: Adapter): void {
  adapters.set(adapter.name, adapter);
}

export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}
