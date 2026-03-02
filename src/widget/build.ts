import { build } from "tsup/dist/index.js";

await build({
  entry: ["src/widget/changelog-feed.ts"],
  format: ["esm"],
  minify: true,
  outDir: "public",
  clean: false,
  sourcemap: false,
  target: "es2022",
  platform: "browser",
  noExternal: ["lit", "lit/decorators.js", "./icons.ts"],
});
