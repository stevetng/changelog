import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getIcon } from "./icons.ts";

interface FeedEntry {
  id: string;
  platform: string;
  date: string;
  title: string;
  body?: string;
  url?: string;
  tags?: string[];
  media?: { type: "image" | "video"; url: string; alt?: string };
}

interface FeedResponse {
  meta: { total: number; page: number; limit: number };
  entries: FeedEntry[];
}

@customElement("changelog-feed")
export class ChangelogFeed extends LitElement {
  @property({ type: String }) src = "";
  @property({ type: Number }) max = 20;
  @property({ type: String }) theme: "light" | "dark" | "auto" = "auto";
  @property({ type: String, attribute: "filter-tags" }) filterTags = "";
  @property({ type: String, attribute: "filter-source" }) filterSource = "";
  @property({ type: Boolean, attribute: "show-filters" }) showFilters = false;

  @state() private _entries: FeedEntry[] = [];
  @state() private _total = 0;
  @state() private _page = 1;
  @state() private _loading = true;
  @state() private _error = "";
  @state() private _expandedIds = new Set<string>();
  @state() private _activeTag = "";
  @state() private _activeSource = "";
  @state() private _availableTags: string[] = [];
  @state() private _availableSources: string[] = [];

  static override styles = css`
    :host {
      --cl-font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
      --cl-font-sans: "Instrument Sans", system-ui, -apple-system, sans-serif;
      --cl-bg: #fafaf9;
      --cl-text: #1c1917;
      --cl-text-muted: #78716c;
      --cl-accent: #6366f1;
      --cl-border: #e7e5e4;
      --cl-radius: 6px;
      --cl-max-width: 640px;
      --cl-entry-gap: 2px;

      display: block;
      font-family: var(--cl-font-sans);
      color: var(--cl-text);
      background: var(--cl-bg);
      max-width: var(--cl-max-width);
      line-height: 1.5;
    }

    :host([theme="dark"]) {
      --cl-bg: #1c1917;
      --cl-text: #fafaf9;
      --cl-text-muted: #a8a29e;
      --cl-border: #44403c;
    }

    @media (prefers-color-scheme: dark) {
      :host([theme="auto"]) {
        --cl-bg: #1c1917;
        --cl-text: #fafaf9;
        --cl-text-muted: #a8a29e;
        --cl-border: #44403c;
      }
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    /* Filter bar */
    .filters {
      display: flex;
      gap: 6px;
      padding: 0 0 12px;
      overflow-x: auto;
      scrollbar-width: thin;
      flex-wrap: wrap;
    }

    .chip {
      font-family: var(--cl-font-mono);
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 999px;
      border: 1px solid var(--cl-border);
      background: transparent;
      color: var(--cl-text-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
      line-height: 1.4;
    }

    .chip:hover {
      border-color: var(--cl-accent);
      color: var(--cl-text);
    }

    .chip[aria-pressed="true"] {
      background: var(--cl-accent);
      border-color: var(--cl-accent);
      color: #fff;
    }

    /* Entry list */
    .entries {
      display: flex;
      flex-direction: column;
      gap: var(--cl-entry-gap);
    }

    .entry {
      border-left: 3px solid transparent;
      padding: 8px 12px;
      border-radius: var(--cl-radius);
      transition: border-color 0.15s ease;
      cursor: pointer;
    }

    .entry:hover,
    .entry:focus-visible {
      border-left-color: var(--cl-accent);
      outline: none;
    }

    .entry-row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 28px;
    }

    .entry-date {
      font-family: var(--cl-font-mono);
      font-size: 12px;
      color: var(--cl-text-muted);
      flex-shrink: 0;
      min-width: 80px;
    }

    .entry-icon {
      flex-shrink: 0;
      color: var(--cl-text-muted);
      display: flex;
      align-items: center;
    }

    .entry-icon svg {
      width: 16px;
      height: 16px;
    }

    .entry-title {
      flex: 1;
      font-size: 14px;
      color: var(--cl-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .entry-title a {
      color: inherit;
      text-decoration: none;
    }

    .entry-title a:hover {
      text-decoration: underline;
    }

    .entry-arrow {
      flex-shrink: 0;
      color: var(--cl-text-muted);
      display: flex;
      align-items: center;
      transition: transform 0.2s ease;
    }

    .entry[aria-expanded="true"] .entry-arrow {
      transform: rotate(90deg);
    }

    .entry-body {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.2s ease;
    }

    .entry[aria-expanded="true"] .entry-body {
      max-height: 800px;
    }

    .entry-body-inner {
      padding: 8px 0 4px 90px;
      font-size: 13px;
      color: var(--cl-text-muted);
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .entry-media {
      margin-top: 8px;
      max-width: 100%;
      border-radius: var(--cl-radius);
    }

    .entry-media img {
      max-width: 100%;
      height: auto;
      border-radius: var(--cl-radius);
      display: block;
    }

    .entry-tags {
      display: flex;
      gap: 4px;
      margin-top: 6px;
      flex-wrap: wrap;
    }

    .entry-tag {
      font-family: var(--cl-font-mono);
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--cl-border);
      color: var(--cl-text-muted);
    }

    /* Load more */
    .load-more {
      display: flex;
      justify-content: center;
      padding: 16px 0 4px;
    }

    .load-more button {
      font-family: var(--cl-font-mono);
      font-size: 12px;
      padding: 6px 20px;
      border: 1px solid var(--cl-border);
      border-radius: var(--cl-radius);
      background: transparent;
      color: var(--cl-text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .load-more button:hover {
      border-color: var(--cl-accent);
      color: var(--cl-text);
    }

    .load-more button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Loading skeleton */
    .skeleton {
      display: flex;
      flex-direction: column;
      gap: var(--cl-entry-gap);
    }

    .skeleton-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      min-height: 28px;
    }

    .skeleton-block {
      background: linear-gradient(90deg, var(--cl-border) 25%, transparent 50%, var(--cl-border) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
      height: 14px;
    }

    .skeleton-date { width: 80px; }
    .skeleton-icon { width: 16px; height: 16px; border-radius: 50%; }
    .skeleton-title { flex: 1; }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Empty state */
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px 16px;
      color: var(--cl-text-muted);
    }

    .empty-icon {
      color: var(--cl-border);
    }

    .empty-text {
      font-size: 14px;
    }

    /* Error state */
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 32px 16px;
      color: var(--cl-text-muted);
    }

    .error-text {
      font-size: 14px;
    }

    .retry-btn {
      font-family: var(--cl-font-mono);
      font-size: 12px;
      padding: 5px 16px;
      border: 1px solid var(--cl-border);
      border-radius: var(--cl-radius);
      background: transparent;
      color: var(--cl-text);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }

    .retry-btn:hover {
      border-color: var(--cl-accent);
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this._fetchEntries();
  }

  private async _fetchEntries(append = false) {
    if (!this.src) {
      this._error = "No 'src' attribute provided.";
      this._loading = false;
      return;
    }

    if (!append) {
      this._loading = true;
      this._error = "";
    }

    try {
      const url = new URL(this.src, window.location.href);
      url.searchParams.set("page", String(this._page));
      url.searchParams.set("limit", String(this.max));

      // Apply filters
      const activeTag = this._activeTag || this.filterTags?.split(",")[0]?.trim();
      const activeSource = this._activeSource || this.filterSource;

      if (activeTag && !this._activeTag && !this._activeSource) {
        // Initial filter from attributes
      }
      if (this._activeTag) {
        url.searchParams.set("tag", this._activeTag);
      } else if (this.filterTags && !this.showFilters) {
        url.searchParams.set("tag", this.filterTags.split(",")[0].trim());
      }

      if (this._activeSource) {
        url.searchParams.set("source", this._activeSource);
      } else if (this.filterSource && !this.showFilters) {
        url.searchParams.set("source", this.filterSource);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as FeedResponse;

      if (append) {
        this._entries = [...this._entries, ...data.entries];
      } else {
        this._entries = data.entries;
      }
      this._total = data.meta.total;

      // Collect available tags and sources for filter chips
      if (this.showFilters && this._page === 1 && !append) {
        this._collectFilters(data.entries);
      }
    } catch (err) {
      this._error = "Couldn't load updates.";
    } finally {
      this._loading = false;
    }
  }

  private _collectFilters(entries: FeedEntry[]) {
    const tags = new Set<string>(this._availableTags);
    const sources = new Set<string>(this._availableSources);

    for (const entry of entries) {
      if (entry.tags) entry.tags.forEach((t) => tags.add(t));
      sources.add(entry.platform);
    }

    // Also add from filterTags/filterSource attributes
    if (this.filterTags) {
      this.filterTags.split(",").forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) tags.add(trimmed);
      });
    }

    this._availableTags = Array.from(tags).sort();
    this._availableSources = Array.from(sources).sort();
  }

  private _toggleExpanded(id: string) {
    const next = new Set(this._expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this._expandedIds = next;
  }

  private _handleFilterTag(tag: string) {
    this._activeTag = this._activeTag === tag ? "" : tag;
    this._page = 1;
    this._fetchEntries();
  }

  private _handleFilterSource(source: string) {
    this._activeSource = this._activeSource === source ? "" : source;
    this._page = 1;
    this._fetchEntries();
  }

  private _loadMore() {
    this._page++;
    this._fetchEntries(true);
  }

  private _retry() {
    this._page = 1;
    this._fetchEntries();
  }

  private _formatDate(iso: string): string {
    const d = new Date(iso);
    const month = d.toLocaleString("en-US", { month: "short" });
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  private _handleEntryKeydown(e: KeyboardEvent, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._toggleExpanded(id);
    }
  }

  private _renderFilters() {
    if (!this.showFilters) return nothing;

    return html`
      <div class="filters" role="toolbar" aria-label="Filters">
        ${this._availableSources.map(
          (source) => html`
            <button
              class="chip"
              role="switch"
              aria-pressed="${this._activeSource === source}"
              @click="${() => this._handleFilterSource(source)}"
            >${source}</button>
          `
        )}
        ${this._availableTags.map(
          (tag) => html`
            <button
              class="chip"
              role="switch"
              aria-pressed="${this._activeTag === tag}"
              @click="${() => this._handleFilterTag(tag)}"
            >${tag}</button>
          `
        )}
      </div>
    `;
  }

  private _renderSkeleton() {
    return html`
      <div class="skeleton" aria-busy="true" aria-label="Loading entries">
        ${[0, 1, 2].map(
          () => html`
            <div class="skeleton-row">
              <div class="skeleton-block skeleton-date"></div>
              <div class="skeleton-block skeleton-icon"></div>
              <div class="skeleton-block skeleton-title"></div>
            </div>
          `
        )}
      </div>
    `;
  }

  private _renderEmpty() {
    return html`
      <div class="empty" role="status">
        <div class="empty-icon">${getIcon("clipboard")}</div>
        <div class="empty-text">Nothing here yet.</div>
      </div>
    `;
  }

  private _renderError() {
    return html`
      <div class="error" role="alert">
        <div class="error-text">${this._error}</div>
        <button class="retry-btn" @click="${this._retry}">
          ${getIcon("retry")} Retry
        </button>
      </div>
    `;
  }

  private _renderEntry(entry: FeedEntry) {
    const expanded = this._expandedIds.has(entry.id);
    const hasBody = !!(entry.body || entry.media);

    return html`
      <div
        class="entry"
        role="${hasBody ? "button" : "listitem"}"
        tabindex="0"
        aria-expanded="${hasBody ? String(expanded) : nothing}"
        @click="${hasBody ? () => this._toggleExpanded(entry.id) : nothing}"
        @keydown="${hasBody ? (e: KeyboardEvent) => this._handleEntryKeydown(e, entry.id) : nothing}"
      >
        <div class="entry-row">
          <span class="entry-date">${this._formatDate(entry.date)}</span>
          <span class="entry-icon" aria-label="${entry.platform}">${getIcon(entry.platform)}</span>
          <span class="entry-title">
            ${entry.url
              ? html`<a href="${entry.url}" target="_blank" rel="noopener" @click="${(e: Event) => e.stopPropagation()}">${entry.title}</a>`
              : entry.title}
          </span>
          ${hasBody ? html`<span class="entry-arrow">${getIcon("arrow")}</span>` : nothing}
        </div>
        ${hasBody
          ? html`
              <div class="entry-body">
                <div class="entry-body-inner">
                  ${entry.body ?? ""}
                  ${entry.media
                    ? html`
                        <div class="entry-media">
                          ${entry.media.type === "image"
                            ? html`<img src="${entry.media.url}" alt="${entry.media.alt ?? ""}" loading="lazy" />`
                            : html`<img src="${entry.media.url}" alt="${entry.media.alt ?? "Video thumbnail"}" loading="lazy" />`}
                        </div>
                      `
                    : nothing}
                  ${entry.tags?.length
                    ? html`
                        <div class="entry-tags">
                          ${entry.tags.map(
                            (tag) => html`<span class="entry-tag">${tag}</span>`
                          )}
                        </div>
                      `
                    : nothing}
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  override render() {
    if (this._loading && this._entries.length === 0) {
      return this._renderSkeleton();
    }

    if (this._error && this._entries.length === 0) {
      return this._renderError();
    }

    if (this._entries.length === 0) {
      return this._renderEmpty();
    }

    const hasMore = this._entries.length < this._total;

    return html`
      ${this._renderFilters()}
      <div class="entries" role="list" aria-label="Changelog entries">
        ${this._entries.map((entry) => this._renderEntry(entry))}
      </div>
      ${hasMore
        ? html`
            <div class="load-more">
              <button @click="${this._loadMore}" ?disabled="${this._loading}">
                ${this._loading ? "Loading..." : "Load more"}
              </button>
            </div>
          `
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "changelog-feed": ChangelogFeed;
  }
}
