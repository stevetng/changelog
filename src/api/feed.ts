import type { ChangelogEntry } from "../adapters/types.ts";
import type { ChangelogConfig } from "../config.ts";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateRss(entries: ChangelogEntry[], config: ChangelogConfig): string {
  const siteUrl = config.site.url ?? "";
  const items = entries
    .map(
      (e) => `    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${escapeXml(e.url ?? siteUrl)}</link>
      <guid isPermaLink="false">${escapeXml(e.id)}</guid>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
      <description>${escapeXml(e.body ?? e.title)}</description>
      ${(e.tags ?? []).map((t) => `<category>${escapeXml(t)}</category>`).join("\n      ")}
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.site.title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(config.site.description)}</description>
    <atom:link href="${escapeXml(siteUrl + "/api/changelog.rss")}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

export function generateAtom(entries: ChangelogEntry[], config: ChangelogConfig): string {
  const siteUrl = config.site.url ?? "";
  const atomEntries = entries
    .map(
      (e) => `  <entry>
    <title>${escapeXml(e.title)}</title>
    <link href="${escapeXml(e.url ?? siteUrl)}"/>
    <id>urn:changelog:${escapeXml(e.id)}</id>
    <updated>${new Date(e.date).toISOString()}</updated>
    <summary>${escapeXml(e.body ?? e.title)}</summary>
    ${(e.tags ?? []).map((t) => `<category term="${escapeXml(t)}"/>`).join("\n    ")}
  </entry>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(config.site.title)}</title>
  <link href="${escapeXml(siteUrl)}"/>
  <link href="${escapeXml(siteUrl + "/api/changelog.atom")}" rel="self"/>
  <id>${escapeXml(siteUrl)}</id>
  <updated>${new Date().toISOString()}</updated>
  ${config.site.author ? `<author><name>${escapeXml(config.site.author)}</name></author>` : ""}
  <subtitle>${escapeXml(config.site.description)}</subtitle>
${atomEntries}
</feed>`;
}
