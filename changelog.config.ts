import { defineConfig } from "./src/config.ts";

export default defineConfig({
  site: {
    title: "Changelog",
    description: "What I've been shipping, writing, and thinking about.",
    url: "https://yoursite.com",
    author: "Your Name",
  },

  syncInterval: "0 */4 * * *",

  sources: [
    {
      adapter: "manual",
      directory: "./content/changelog",
    },
  ],

  filters: {
    maxAge: "1y",
    maxEntries: 500,
  },

  output: {
    json: true,
    rss: false,
    atom: false,
  },
});
