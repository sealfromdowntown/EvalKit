import type Database from "better-sqlite3";
import type { ScoreRow } from "./align";

/** All score rows for one candidate in one run, in the shape alignScores expects. */
export function loadScores(
  db: Database.Database,
  runId: string,
  candidate: string,
): ScoreRow[] {
  const rows = db
    .prepare("SELECT case_id, passed, failure FROM scores WHERE run_id = ? AND candidate = ?")
    .all(runId, candidate) as { case_id: string; passed: number; failure: string | null }[];

  return rows.map((r) => ({
    caseId: r.case_id,
    passed: r.passed === 1,
    failure: r.failure,
  }));
}

/** The most recent run that contains every named candidate, or null if none does. */
export function latestRunWith(db: Database.Database, candidates: string[]): string | null {
  const placeholders = candidates.map(() => "?").join(", ");
  const row = db
    .prepare(
      `SELECT s.run_id AS run_id
       FROM scores s
       JOIN runs r ON r.run_id = s.run_id
       WHERE s.candidate IN (${placeholders})
       GROUP BY s.run_id
       HAVING COUNT(DISTINCT s.candidate) = ?
       ORDER BY r.started_at DESC
       LIMIT 1`,
    )
    .get(...candidates, candidates.length) as { run_id: string } | undefined;
  return row?.run_id ?? null;
}

/** Which split (dev, test, all) a run used, so results can be labelled honestly. */
export function runSplit(db: Database.Database, runId: string): string {
  const row = db.prepare("SELECT split FROM runs WHERE run_id = ?").get(runId) as
    | { split: string }
    | undefined;
  return row?.split ?? "unknown";
}