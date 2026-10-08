import Database from "better-sqlite3";

export function openResultsDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      cache_key        TEXT PRIMARY KEY,
      provider         TEXT NOT NULL,
      model            TEXT NOT NULL,
      prompt_hash      TEXT NOT NULL,
      question         TEXT NOT NULL,
      output_text      TEXT NOT NULL,
      finish_reason    TEXT,
      latency_ms       INTEGER NOT NULL,
      tokens_in        INTEGER,
      tokens_out       INTEGER,
      reasoning_tokens INTEGER,
      cost_usd         REAL,
      created_at       TEXT NOT NULL
    );
  `);
  return db;
}