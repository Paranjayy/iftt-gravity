import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdirSync } from "fs";
import { homedir } from "os";

const DATA_DIR = join(homedir(), ".gravity");
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, "archive.db");
const db = new Database(DB_PATH);

// Initialize table
db.run(`
  CREATE TABLE IF NOT EXISTS archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    source_app TEXT,
    labels TEXT,
    token_count INTEGER,
    is_bookmarked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Index for fast searching
db.run(`CREATE INDEX IF NOT EXISTS idx_content ON archive(content);`);

export interface ArchiveItem {
  id: number;
  content: string;
  type: string;
  source_app: string;
  labels: string;
  token_count: number;
  is_bookmarked: boolean;
  created_at: string;
}

export const ArchiveDB = {
  add: (content: string, type: string = "text", sourceApp: string = "Unknown", labels: string = "", tokenCount: number = 0) => {
    // Prevent duplicates of the exact same content consecutively
    const last = db.query("SELECT content FROM archive ORDER BY id DESC LIMIT 1").get() as any;
    if (last && last.content === content) return null;

    return db.run("INSERT INTO archive (content, type, source_app, labels, token_count) VALUES (?, ?, ?, ?, ?)", [content, type, sourceApp, labels, tokenCount]);
  },

  updateLabels: (id: number, labels: string) => {
    return db.run("UPDATE archive SET labels = ? WHERE id = ?", [labels, id]);
  },

  list: (limit: number = 50, offset: number = 0) => {
    return db.query("SELECT * FROM archive ORDER BY id DESC LIMIT ? OFFSET ?").all(limit, offset) as ArchiveItem[];
  },

  search: (query: string, limit: number = 50) => {
    return db.query("SELECT * FROM archive WHERE content LIKE ? ORDER BY id DESC LIMIT ?").all(`%${query}%`, limit) as ArchiveItem[];
  },

  toggleBookmark: (id: number) => {
    return db.run("UPDATE archive SET is_bookmarked = 1 - is_bookmarked WHERE id = ?", [id]);
  },

  getBookmarks: () => {
    return db.query("SELECT * FROM archive WHERE is_bookmarked = 1 ORDER BY id DESC").all() as ArchiveItem[];
  },

  delete: (id: number) => {
    return db.run("DELETE FROM archive WHERE id = ?", [id]);
  },

  importItems: (items: any[]) => {
    const insert = db.prepare("INSERT INTO archive (content, type, is_bookmarked, created_at) VALUES (?, ?, ?, ?)");
    for (const item of items) {
      insert.run(item.content, item.type, item.is_bookmarked ? 1 : 0, item.created_at);
    }
  },

  clearAll: () => {
    db.run("DELETE FROM archive");
    db.run("DELETE FROM sqlite_sequence WHERE name='archive'");
  }
};
