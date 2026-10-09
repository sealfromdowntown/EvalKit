import { describe, it, expect } from "vitest";
import { alignScores, type ScoreRow } from "./align";
import { pairedDifferences } from "./paired";

const row = (caseId: string, passed: boolean, failure: string | null = null): ScoreRow => ({
  caseId,
  passed,
  failure: passed ? null : (failure ?? "wrong_result"),
});

describe("alignScores", () => {
  it("lines up the same cases even when the input order differs", () => {
    const A = [row("c2", false), row("c1", true)];
    const B = [row("c1", true), row("c2", true)];
    const r = alignScores(A, B);
    expect(r.caseIds).toEqual(["c1", "c2"]);
    expect(r.a).toEqual([1, 0]);
    expect(r.b).toEqual([1, 1]);
  });

  it("excludes a case from both sides when A had an API error", () => {
    const A = [row("c1", false, "api_error"), row("c2", true)];
    const B = [row("c1", true), row("c2", true)];
    const r = alignScores(A, B);
    expect(r.caseIds).toEqual(["c2"]);
    expect(r.excluded).toEqual(["c1"]);
    expect(r.a).toHaveLength(r.b.length);
  });

  it("excludes a case when only B had an API error", () => {
    const A = [row("c1", true), row("c2", true)];
    const B = [row("c1", false, "api_error"), row("c2", true)];
    const r = alignScores(A, B);
    expect(r.caseIds).toEqual(["c2"]);
    expect(r.excluded).toEqual(["c1"]);
  });

  it("keeps other failures in the comparison", () => {
    const A = [row("c1", false, "sql_error")];
    const B = [row("c1", false, "timeout")];
    const r = alignScores(A, B);
    expect(r.caseIds).toEqual(["c1"]);
    expect(r.a).toEqual([0]);
    expect(r.b).toEqual([0]);
    expect(r.excluded).toEqual([]);
  });

  it("skips and reports a case that only one candidate has", () => {
    const A = [row("c1", true), row("c2", true)];
    const B = [row("c1", true)];
    const r = alignScores(A, B);
    expect(r.caseIds).toEqual(["c1"]);
    expect(r.missing).toEqual(["c2"]);
  });

  it("throws on a duplicate case id within one candidate", () => {
    const A = [row("c1", true), row("c1", false)];
    const B = [row("c1", true)];
    expect(() => alignScores(A, B)).toThrow(/duplicate/);
  });

  it("feeds straight into pairedDifferences", () => {
    const A = [row("c1", false), row("c2", true), row("c3", true)];
    const B = [row("c1", true), row("c2", true), row("c3", false)];
    const r = alignScores(A, B);
    expect(pairedDifferences(r.a, r.b)).toEqual([1, 0, -1]);
  });
});