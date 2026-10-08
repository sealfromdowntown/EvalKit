import { createHash } from "node:crypto";
import type { Case } from "./schema";
import { executeSql } from "../executor/index";

export interface ExpectedEntry {
  sqlHash: string;
  columns: string[];
  rows: unknown[][];
}

export interface ExpectedFile {
  dataset: { rowCount: number; firstMonth: string; lastMonth: string };
  cases: Record<string, ExpectedEntry>;
}

export const hashSql = (sql: string): string =>
  createHash("sha256").update(sql.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);

export function isEmptyResult(e: ExpectedEntry): boolean {
  return e.rows.length === 0 || (e.rows.length === 1 && e.rows[0].every((v) => v === null));
}

export async function computeExpected(cases: Case[], dbPath: string): Promise<ExpectedFile> {
  const meta = await executeSql("SELECT COUNT(*), MIN(month), MAX(month) FROM resale", { dbPath });
  if (!meta.ok) throw new Error(`Cannot read dataset: ${meta.message}`);
  const [rowCount, firstMonth, lastMonth] = meta.rows[0] as [number, string, string];

  const out: ExpectedFile = { dataset: { rowCount, firstMonth, lastMonth }, cases: {} };

  for (const c of cases) {
    const r = await executeSql(c.reference_sql, { dbPath, timeoutMs: 30_000, maxRows: 1000 });
    if (!r.ok) {
      throw new Error(`Case ${c.id}: reference SQL failed (${r.error}): ${r.message}`);
    }
    if (r.truncated) {
      throw new Error(`Case ${c.id}: result has over 1000 rows; make the question narrower`);
    }
    out.cases[c.id] = { sqlHash: hashSql(c.reference_sql), columns: r.columns, rows: r.rows };
  }
  return out;
}