CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_id TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  tags TEXT DEFAULT '[]',
  media_url TEXT,
  media_type TEXT,
  raw_data TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(platform, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_entries_platform ON entries(platform);
CREATE INDEX IF NOT EXISTS idx_entries_tags ON entries(tags);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adapter TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  entries_added INTEGER DEFAULT 0,
  entries_updated INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  error_message TEXT
);
