import type { Adapter, AdapterResult } from "./types.ts";

export const linkedinAdapter: Adapter = {
  name: "linkedin",

  async fetch(_config): Promise<AdapterResult> {
    // LinkedIn's API restricts programmatic access to personal posts.
    // The Community Management API requires app review and is limited to
    // organization pages. For personal changelog use, add LinkedIn posts
    // manually using the 'manual' adapter with markdown files.
    return {
      entries: [],
      errors: [
        "LinkedIn adapter is not yet implemented. LinkedIn's API restricts access to personal post data. " +
          "Use the 'manual' adapter to add LinkedIn posts as markdown entries.",
      ],
    };
  },
};
