import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Case } from "../cases/schema";
import { executeSql } from "../executor/index";
import type { CompareRules, Expected } from "./execution";
import { scoreExecution } from "./execution";

type ProbeRows = NonNullable<Case["intent_probe"]>["rows"];

const probeSchema = `
  CREATE TABLE resale (
    month TEXT NOT NULL,
    town TEXT NOT NULL,
    flat_type TEXT NOT NULL,
    block TEXT NOT NULL,
    street_name TEXT NOT NULL,
    storey_range TEXT NOT NULL,
    floor_area_sqm REAL NOT NULL,
    flat_model TEXT NOT NULL,
    lease_commence_date INTEGER NOT NULL,
    remaining_lease TEXT,
    resale_price INTEGER NOT NULL
  );
`;

const defaults = {
  month: "2018-01",
  town: "GEYLANG",
  flat_type: "1 ROOM",
  block: "1",
  street_name: "PROBE STREET",
  storey_range: "01 TO 03",
  floor_area_sqm: 50,
  flat_model: "Improved",
  lease_commence_date: 2000,
  remaining_lease: "70 years 0 months",
  resale_price: 300000,
};

function writeProbeDatabase(path: string, rows: ProbeRows): void {
  const db = new Database(path);
  try {
    db.exec(probeSchema);
    const insert = db.prepare(`
      INSERT INTO resale (
        month, town, flat_type, block, street_name, storey_range, floor_area_sqm,
        flat_model, lease_commence_date, remaining_lease, resale_price
      ) VALUES (
        @month, @town, @flat_type, @block, @street_name, @storey_range, @floor_area_sqm,
        @flat_model, @lease_commence_date, @remaining_lease, @resale_price
      )
    `);
    const addRows = db.transaction(() => {
      for (const row of rows) insert.run({ ...defaults, ...row });
    });
    addRows();
  } finally {
    db.close();
  }
}

/** Rechecks SQL against a tiny case-specific dataset designed to expose wrong filters. */
export async function scoreIntentProbe(
  candidateSql: string,
  referenceSql: string,
  probeRows: ProbeRows,
  rules?: CompareRules,
): Promise<{ pass: boolean; detail: string }> {
  const directory = mkdtempSync(join(tmpdir(), "evalkit-intent-probe-"));
  const dbPath = join(directory, "probe.db");

  try {
    writeProbeDatabase(dbPath, probeRows);
    const reference = await executeSql(referenceSql, { dbPath });
    if (!reference.ok || reference.truncated) {
      throw new Error(`Intent probe reference query failed: ${reference.ok ? "result truncated" : reference.message}`);
    }
    const expected: Expected = { columns: reference.columns, rows: reference.rows };
    if (expected.rows.length === 0 || expected.rows.every((row) => row.every((value) => value === 0))) {
      throw new Error("Intent probe rows do not distinguish the reference query from a zero-result query");
    }

    const actual = await executeSql(candidateSql, { dbPath });
    const score = scoreExecution(actual, expected, rules);
    return score.pass
      ? { pass: true, detail: "intent probe matched" }
      : {
          pass: false,
          detail: `Intent probe failed: ${score.detail}; probe expected ${JSON.stringify(expected.rows)}`,
        };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
