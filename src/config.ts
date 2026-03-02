import { z } from "zod";

const sourceSchema = z
  .object({
    adapter: z.string(),
    tagAs: z.array(z.string()).optional(),
  })
  .passthrough();

const configSchema = z.object({
  site: z.object({
    title: z.string().default("Changelog"),
    description: z.string().default(""),
    url: z.string().url().optional(),
    author: z.string().optional(),
  }),
  syncInterval: z.string().default("0 */4 * * *"),
  sources: z.array(sourceSchema).min(1, "At least one source is required"),
  filters: z
    .object({
      maxAge: z.string().optional(),
      maxEntries: z.number().int().positive().optional(),
    })
    .optional(),
  output: z
    .object({
      json: z.boolean().default(true),
      rss: z.boolean().default(false),
      atom: z.boolean().default(false),
    })
    .optional(),
  corsOrigins: z.array(z.string()).optional(),
});

export type ChangelogConfig = z.infer<typeof configSchema>;

export function defineConfig(config: z.input<typeof configSchema>): ChangelogConfig {
  return configSchema.parse(config);
}

let _config: ChangelogConfig | null = null;

export async function loadConfig(): Promise<ChangelogConfig> {
  if (_config) return _config;

  try {
    const configPath = new URL("../changelog.config.ts", import.meta.url).pathname;
    const mod = await import(configPath);
    _config = mod.default as ChangelogConfig;
    return _config;
  } catch {
    throw new Error(
      "Could not load changelog.config.ts. Make sure it exists in the project root and exports a default config via defineConfig()."
    );
  }
}

export function getConfig(): ChangelogConfig {
  if (!_config) throw new Error("Config not loaded. Call loadConfig() first.");
  return _config;
}

export function setConfig(config: ChangelogConfig): void {
  _config = config;
}
