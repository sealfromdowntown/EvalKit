import type { ExecResult } from "../executor/index";

export type Failure =
  | "api_error"
  | "no_sql"
  | "rejected"
  | "timeout"
  | "sql_error"
  | "shape_mismatch"
  | "wrong_result"
  | "intent_probe_failed";

export interface Score {
  pass: boolean;
  failure: Failure | null;
  detail: string;
}

export interface CompareRules {
  ordered?: boolean; // default false: row order is ignored
  tolerance?: number; // default 0.5: absolute tolerance for numbers
}

export interface Expected {
  columns: string[];
  rows: unknown[][];
}

export const DEFAULT_TOLERANCE = 0.5;

function valuesEqual(a: unknown, b: unknown, tol: number): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= tol;
  return String(a).trim() === String(b).trim();
}

function rowsEqual(a: unknown[], b: unknown[], tol: number): boolean {
  return a.length === b.length && a.every((v, i) => valuesEqual(v, b[i], tol));
}

const preview = (rows: unknown[][]) => JSON.stringify(rows.slice(0, 3));

/**
 * Execution match. Rules (documented in the README):
 *  - column names are ignored, but the column count must match
 *  - row order is ignored unless the case sets compare.ordered
 *  - numbers match within an absolute tolerance (default 0.5, so ROUND(AVG(x),0) passes);
 *    set a smaller compare.tolerance for cases whose answers are small fractions
 *  - NULL equals NULL; other values compare as trimmed strings
 */
export function scoreExecution(
  actual: ExecResult,
  expected: Expected,
  rules: CompareRules = {},
): Score {
  if (!actual.ok) {
    return { pass: false, failure: actual.error, detail: actual.message };
  }
  const tol = rules.tolerance ?? DEFAULT_TOLERANCE;

  if (actual.truncated) {
    return { pass: false, failure: "wrong_result", detail: "Result exceeded the row limit" };
  }
  if (actual.columns.length !== expected.columns.length) {
    return {
      pass: false,
      failure: "shape_mismatch",
      detail: `Expected ${expected.columns.length} column(s), got ${actual.columns.length}`,
    };
  }
  if (actual.rows.length !== expected.rows.length) {
    return {
      pass: false,
      failure: "wrong_result",
      detail: `Expected ${expected.rows.length} row(s), got ${actual.rows.length}: ${preview(actual.rows)}`,
    };
  }

  let match = true;
  if (rules.ordered) {
    match = expected.rows.every((row, i) => rowsEqual(actual.rows[i], row, tol));
  } else {
    const used = new Set<number>();
    for (const row of expected.rows) {
      const idx = actual.rows.findIndex((r, i) => !used.has(i) && rowsEqual(r, row, tol));
      if (idx === -1) {
        match = false;
        break;
      }
      used.add(idx);
    }
  }

  return match
    ? { pass: true, failure: null, detail: "match" }
    : {
        pass: false,
        failure: "wrong_result",
        detail: `Expected ${preview(expected.rows)}, got ${preview(actual.rows)}`,
      };
}
