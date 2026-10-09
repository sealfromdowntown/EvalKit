import { describe, it, expect } from "vitest";
import type { ScoreRow } from "./align";
import { compareCandidates } from "./compare";

const mk = (passes: boolean[]): ScoreRow[] =>
  passes.map((p, i) => ({
    caseId: `c${String(i).padStart(3, "0")}`,
    passed: p,
    failure: p ? null : "wrong_result",
  }));

describe("compareCandidates", () => {
  it("counts fixed, broken and tied cases, with B as the reference direction", () => {
    const A = mk([false, true, true, false]);
    const B = mk([true, true, false, false]);
    const c = compareCandidates("A", A, "B", B);
    expect(c.n).toBe(4);
    expect(c.fixed).toEqual(["c000"]);
    expect(c.broken).toEqual(["c002"]);
    expect(c.ties).toBe(2);
    expect(c.passedA).toBe(2);
    expect(c.passedB).toBe(2);
  });

  it("reports a clear effect as significant (30 fixed, 10 broken, 60 ties)", () => {
    const A = mk([...Array(30).fill(false), ...Array(10).fill(true), ...Array(60).fill(true)]);
    const B = mk([...Array(30).fill(true), ...Array(10).fill(false), ...Array(60).fill(true)]);
    const c = compareCandidates("A", A, "B", B);
    expect(c.significant).toBe(true);
    expect(c.interval.lower).toBeGreaterThan(0);
  });

  it("does not report a balanced result as significant (20 fixed, 20 broken)", () => {
    const A = mk([...Array(20).fill(false), ...Array(20).fill(true), ...Array(60).fill(true)]);
    const B = mk([...Array(20).fill(true), ...Array(20).fill(false), ...Array(60).fill(true)]);
    const c = compareCandidates("A", A, "B", B);
    expect(c.significant).toBe(false);
  });

  it("excludes API errors and reports them", () => {
    const A: ScoreRow[] = [
      { caseId: "c1", passed: false, failure: "api_error" },
      { caseId: "c2", passed: true, failure: null },
    ];
    const B = mk([true, true]).map((r, i) => ({ ...r, caseId: `c${i + 1}` }));
    const c = compareCandidates("A", A, "B", B);
    expect(c.n).toBe(1);
    expect(c.excluded).toEqual(["c1"]);
  });

  it("throws when there are no cases in common", () => {
    const A: ScoreRow[] = [{ caseId: "x", passed: true, failure: null }];
    const B: ScoreRow[] = [{ caseId: "y", passed: true, failure: null }];
    expect(() => compareCandidates("A", A, "B", B)).toThrow(/no cases in common/);
  });

  it("collapses the interval to zero when every case ties", () => {
    const rows = mk(Array(20).fill(true));
    const c = compareCandidates("A", rows, "B", rows);
    expect(c.ties).toBe(20);
    expect(c.interval.lower).toBe(0);
    expect(c.interval.upper).toBe(0);
    expect(c.significant).toBe(false);
  });
});