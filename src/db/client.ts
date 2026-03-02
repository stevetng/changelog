import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { ChangelogEntry } from "../adapters/types.ts";

let _db: BetterSqlite3.Database | null = null;

export function getDb(dbPath?: string): BetterSqlite3.Database {
  if (_db) return _db;
  const path = dbPath ?? process.env.DATABASE_URL?.replace("file:", "") ?? "./data/changelog.db";
  _db = new Database(path);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}

export function setDb(db: BetterSqlite3.Database): void {
  _db = db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// --- Entry helpers ---

interface EntryRow {
  id: string;
  platform: string;
  platform_id: string;
  date: string;
  title: string;
  body: string | null;
  url: string | null;
  tags: string;
  media_url: string | null;
  media_type: string | null;
  raw_data: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: EntryRow): ChangelogEntry {
  return {
    id: row.id,
    platform: row.platform,
    platformId: row.platform_id,
    date: row.date,
    title: row.title,
    body: row.body ?? undefined,
    url: row.url ?? undefined,
    tags: JSON.parse(row.tags),
    media:
      row.media_url && row.media_type
        ? { type: row.media_type as "image" | "video", url: row.media_url }
        : undefined,
    rawData: row.raw_data ? JSON.parse(row.raw_data) : undefined,
  };
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  tag?: string;
  source?: string;
}

export function queryEntries(opts: QueryOptions = {}): { entries: ChangelogEntry[]; total: number } {
  const db = getDb();
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.tag) {
    conditions.push("json_each.value = ?");
    params.push(opts.tag);
  }

  if (opts.source) {
    conditions.push("e.platform = ?");
    params.push(opts.source);
  }

  const joinClause = opts.tag ? "JOIN json_each(e.tags) ON json_each.value = ?" : "";
  const joinParams = opts.tag ? [opts.tag] : [];

  const whereConditions: string[] = [];
  const whereParams: unknown[] = [];

  if (opts.source) {
    whereConditions.push("e.platform = ?");
    whereParams.push(opts.source);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const countSql = `SELECT COUNT(*) as count FROM entries e ${joinClause} ${whereClause}`;
  const countParams = [...joinParams, ...whereParams];
  const countRow = db.prepare(countSql).get(...(countParams.length ? [countParams] : [])) as
    | { count: number }
    | undefined;

  // Rebuild for proper parameterized query
  const allParams: unknown[] = [];
  let sql = "SELECT e.* FROM entries e";

  if (opts.tag) {
    sql += " JOIN json_each(e.tags) ON json_each.value = ?";
    allParams.push(opts.tag);
  }

  const filters: string[] = [];
  if (opts.source) {
    filters.push("e.platform = ?");
    allParams.push(opts.source);
  }

  if (filters.length) {
    sql += ` WHERE ${filters.join(" AND ")}`;
  }

  sql += " ORDER BY e.date DESC LIMIT ? OFFSET ?";
  allParams.push(limit, offset);

  const rows = db.prepare(sql).all(...allParams) as EntryRow[];

  // Count query
  const cAllParams: unknown[] = [];
  let cSql = "SELECT COUNT(*) as count FROM entries e";
  if (opts.tag) {
    cSql += " JOIN json_each(e.tags) ON json_each.value = ?";
    cAllParams.push(opts.tag);
  }
  const cFilters: string[] = [];
  if (opts.source) {
    cFilters.push("e.platform = ?");
    cAllParams.push(opts.source);
  }
  if (cFilters.length) {
    cSql += ` WHERE ${cFilters.join(" AND ")}`;
  }

  const total = (db.prepare(cSql).get(...cAllParams) as { count: number })?.count ?? 0;

  return {
    entries: rows.map(rowToEntry),
    total,
  };
}

export function upsertEntry(entry: ChangelogEntry): "added" | "updated" {
  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM entries WHERE platform = ? AND platform_id = ?")
    .get(entry.platform, entry.platformId) as { id: string } | undefined;

  const stmt = db.prepare(`
    INSERT INTO entries (id, platform, platform_id, date, title, body, url, tags, media_url, media_type, raw_data, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(platform, platform_id) DO UPDATE SET
      date = excluded.date,
      title = excluded.title,
      body = excluded.body,
      url = excluded.url,
      tags = excluded.tags,
      media_url = excluded.media_url,
      media_type = excluded.media_type,
      raw_data = excluded.raw_data,
      updated_at = datetime('now')
  `);

  stmt.run(
    entry.id,
    entry.platform,
    entry.platformId,
    entry.date,
    entry.title,
    entry.body ?? null,
    entry.url ?? null,
    JSON.stringify(entry.tags ?? []),
    entry.media?.url ?? null,
    entry.media?.type ?? null,
    entry.rawData ? JSON.stringify(entry.rawData) : null
  );

  return existing ? "updated" : "added";
}

export function upsertEntries(entries: ChangelogEntry[]): { added: number; updated: number } {
  const db = getDb();
  let added = 0;
  let updated = 0;

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      const result = upsertEntry(entry);
      if (result === "added") added++;
      else updated++;
    }
  });

  transaction();
  return { added, updated };
}

export function deleteOldEntries(cutoffDate: string, protectedPlatforms: string[] = ["manual"]): number {
  const db = getDb();
  const placeholders = protectedPlatforms.map(() => "?").join(", ");
  const stmt = db.prepare(
    `DELETE FROM entries WHERE date < ? AND platform NOT IN (${placeholders})`
  );
  const result = stmt.run(cutoffDate, ...protectedPlatforms);
  return result.changes;
}

export function pruneToMaxEntries(maxEntries: number, protectedPlatforms: string[] = ["manual"]): number {
  const db = getDb();
  const placeholders = protectedPlatforms.map(() => "?").join(", ");
  const stmt = db.prepare(`
    DELETE FROM entries WHERE id IN (
      SELECT id FROM entries
      WHERE platform NOT IN (${placeholders})
      ORDER BY date DESC
      LIMIT -1 OFFSET ?
    )
  `);
  const result = stmt.run(...protectedPlatforms, maxEntries);
  return result.changes;
}

// --- Sync log helpers ---

export interface SyncLogRow {
  id: number;
  adapter: string;
  started_at: string;
  finished_at: string | null;
  entries_added: number;
  entries_updated: number;
  status: string;
  error_message: string | null;
}

export function createSyncLog(adapter: string): number {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO sync_log (adapter, started_at) VALUES (?, datetime('now'))")
    .run(adapter);
  return Number(result.lastInsertRowid);
}

export function completeSyncLog(
  id: number,
  status: "success" | "error",
  entriesAdded: number,
  entriesUpdated: number,
  errorMessage?: string
): void {
  const db = getDb();
  db.prepare(
    `UPDATE sync_log SET finished_at = datetime('now'), status = ?, entries_added = ?, entries_updated = ?, error_message = ? WHERE id = ?`
  ).run(status, entriesAdded, entriesUpdated, errorMessage ?? null, id);
}

export function getLatestSyncLogs(): SyncLogRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT sl.* FROM sync_log sl
       INNER JOIN (SELECT adapter, MAX(id) as max_id FROM sync_log GROUP BY adapter) latest
       ON sl.id = latest.max_id
       ORDER BY sl.started_at DESC`
    )
    .all() as SyncLogRow[];
}
