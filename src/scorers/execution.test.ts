import { describe, it, expect } from "vitest";
import type { ExecResult } from "../executor/index";
import { scoreExecution } from "./execution";

const ok = (rows: unknown[][], columns = ["x"]): ExecResult => ({
  ok: true,
  columns,
  rows,
  truncated: false,
});
const exp = (rows: unknown[][], columns = ["x"]) => ({ columns, rows });

describe("scoreExecution", () => {
  it("passes an exact match", () => {
    expect(scoreExecution(ok([[1961]]), exp([[1961]])).pass).toBe(true);
  });

  it("fails a wrong number and reports wrong_result", () => {
    const s = scoreExecution(ok([[0]]), exp([[1961]]));
    expect(s.pass).toBe(false);
    expect(s.failure).toBe("wrong_result");
  });

  it("accepts rounding within the default tolerance", () => {
    expect(scoreExecution(ok([[512346]]), exp([[512345.678]])).pass).toBe(true);
  });

  it("respects a tighter per-case tolerance", () => {
    const s = scoreExecution(ok([[512346]]), exp([[512345.678]]), { tolerance: 0.001 });
    expect(s.pass).toBe(false);
  });

  it("ignores column names", () => {
    expect(scoreExecution(ok([[5]], ["cnt"]), exp([[5]], ["COUNT(*)"])).pass).toBe(true);
  });

  it("reports shape_mismatch when the column count differs", () => {
    const s = scoreExecution(ok([["A", 5]], ["a", "b"]), exp([["A"]], ["a"]));
    expect(s.failure).toBe("shape_mismatch");
  });

  it("fails when the row count differs", () => {
    const s = scoreExecution(ok([[1], [2]]), exp([[1]]));
    expect(s.failure).toBe("wrong_result");
  });

  it("ignores row order by default", () => {
    expect(scoreExecution(ok([["B"], ["A"]]), exp([["A"], ["B"]])).pass).toBe(true);
  });

  it("enforces row order when ordered is set", () => {
    const s = scoreExecution(ok([["B"], ["A"]]), exp([["A"], ["B"]]), { ordered: true });
    expect(s.pass).toBe(false);
  });

  it("treats NULL as equal to NULL only", () => {
    expect(scoreExecution(ok([[null]]), exp([[null]])).pass).toBe(true);
    expect(scoreExecution(ok([[null]]), exp([[0]])).pass).toBe(false);
  });

  it("passes execution errors through as failure types", () => {
    const s = scoreExecution({ ok: false, error: "timeout", message: "slow" }, exp([[1]]));
    expect(s.pass).toBe(false);
    expect(s.failure).toBe("timeout");
  });

  it("fails truncated results", () => {
    const s = scoreExecution({ ok: true, columns: ["x"], rows: [[1]], truncated: true }, exp([[1]]));
    expect(s.pass).toBe(false);
  });
});