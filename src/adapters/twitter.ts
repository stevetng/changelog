import type { Adapter, AdapterResult } from "./types.ts";

export const twitterAdapter: Adapter = {
  name: "twitter",

  async fetch(_config): Promise<AdapterResult> {
    // Twitter/X API v2 requires an expensive Pro plan for search/timeline access.
    // This adapter is stubbed out. If you have a Bearer Token with appropriate
    // access, implement the fetch logic here using the /2/users/:id/tweets endpoint.
    return {
      entries: [],
      errors: [
        "Twitter adapter is not yet implemented. The Twitter/X API requires a paid Pro plan. " +
          "Consider using the RSS adapter with a Twitter-to-RSS bridge (e.g., Nitter) as an alternative.",
      ],
    };
  },
};
