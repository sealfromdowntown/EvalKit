import { describe, it, expect, beforeEach } from "vitest";
import { openResultsDb } from "../db/results";
import { latestRunWith, loadScores, runSplit } from "./load";

let db: ReturnType<typeof openResultsDb>;

function addRun(runId: string, startedAt: string, split = "dev"): void {
  db.prepare(
    "INSERT INTO runs (run_id, started_at, split, candidate_count, case_count) VALUES (?, ?, ?, 1, 1)",
  ).run(runId, startedAt, split);
}

function addScore(
  runId: string,
  candidate: string,
  caseId: string,
  passed: boolean,
  failure: string | null = null,
): void {
  db.prepare(
    "INSERT INTO scores (run_id, candidate, case_id, passed, failure) VALUES (?, ?, ?, ?, ?)",
  ).run(runId, candidate, caseId, passed ? 1 : 0, failure);
}

beforeEach(() => {
  db = openResultsDb(":memory:");
});

describe("loadScores", () => {
  it("returns only the requested run and candidate, converted to ScoreRow", () => {
    addRun("r1", "2026-01-01T00:00:00Z");
    addRun("r2", "2026-01-02T00:00:00Z");
    addScore("r1", "A", "c1", true);
    addScore("r1", "A", "c2", false, "wrong_result");
    addScore("r1", "B", "c1", true);
    addScore("r2", "A", "c1", false, "wrong_result");

    const rows = loadScores(db, "r1", "A");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.caseId === "c1")).toEqual({
      caseId: "c1",
      passed: true,
      failure: null,
    });
    expect(rows.find((r) => r.caseId === "c2")?.passed).toBe(false);
  });
});

describe("latestRunWith", () => {
  it("picks the newest run containing both candidates", () => {
    addRun("old", "2026-01-01T00:00:00Z");
    addRun("new", "2026-01-03T00:00:00Z");
    addScore("old", "A", "c1", true);
    addScore("old", "B", "c1", true);
    addScore("new", "A", "c1", true);
    addScore("new", "B", "c1", true);
    expect(latestRunWith(db, ["A", "B"])).toBe("new");
  });

  it("ignores a newer run that has only one of the candidates", () => {
    addRun("both", "2026-01-01T00:00:00Z");
    addRun("only-a", "2026-01-05T00:00:00Z");
    addScore("both", "A", "c1", true);
    addScore("both", "B", "c1", true);
    addScore("only-a", "A", "c1", true);
    expect(latestRunWith(db, ["A", "B"])).toBe("both");
  });

  it("returns null when no run has both", () => {
    addRun("r1", "2026-01-01T00:00:00Z");
    addScore("r1", "A", "c1", true);
    expect(latestRunWith(db, ["A", "B"])).toBeNull();
  });
});

describe("runSplit", () => {
  it("returns the split recorded for the run", () => {
    addRun("r1", "2026-01-01T00:00:00Z", "test");
    expect(runSplit(db, "r1")).toBe("test");
  });

  it("returns 'unknown' for a missing run", () => {
    expect(runSplit(db, "nope")).toBe("unknown");
  });
});