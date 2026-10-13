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

    CREATE TABLE IF NOT EXISTS runs (
      run_id          TEXT PRIMARY KEY,
      started_at      TEXT NOT NULL,
      split           TEXT NOT NULL,
      candidate_count INTEGER NOT NULL,
      case_count      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scores (
      run_id         TEXT NOT NULL,
      candidate      TEXT NOT NULL,
      case_id        TEXT NOT NULL,
      passed         INTEGER NOT NULL,
      failure        TEXT,
      detail         TEXT,
      model_sql      TEXT,
      actual_preview TEXT,
      cached         INTEGER,
      latency_ms     INTEGER,
      tokens_in      INTEGER,
      tokens_out     INTEGER,
      cost_usd       REAL,
      PRIMARY KEY (run_id, candidate, case_id)
    );

    CREATE TABLE IF NOT EXISTS run_candidates (
      run_id        TEXT NOT NULL,
      candidate     TEXT NOT NULL,
      provider      TEXT NOT NULL,
      model         TEXT NOT NULL,
      prompt_path   TEXT NOT NULL,
      prompt_hash   TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      price_json    TEXT,
      PRIMARY KEY (run_id, candidate)
    );
  `);

  const runCandidateForeignKeys = db.pragma(
    "foreign_key_list(run_candidates)",
  ) as unknown[];

  if (runCandidateForeignKeys.length > 0) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE run_candidates_rebuilt (
          run_id        TEXT NOT NULL,
          candidate     TEXT NOT NULL,
          provider      TEXT NOT NULL,
          model         TEXT NOT NULL,
          prompt_path   TEXT NOT NULL,
          prompt_hash   TEXT NOT NULL,
          settings_json TEXT NOT NULL,
          price_json    TEXT,
          PRIMARY KEY (run_id, candidate)
        );

        INSERT INTO run_candidates_rebuilt (
          run_id, candidate, provider, model, prompt_path,
          prompt_hash, settings_json, price_json
        )
        SELECT
          run_id, candidate, provider, model, prompt_path,
          prompt_hash, settings_json, price_json
        FROM run_candidates;

        DROP TABLE run_candidates;
        ALTER TABLE run_candidates_rebuilt RENAME TO run_candidates;
      `);
    })();
  }

  return db;
}
