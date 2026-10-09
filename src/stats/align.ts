export interface ScoreRow {
  caseId: string;
  passed: boolean;
  failure: string | null; // e.g. "wrong_result", "api_error", or null when passed
}

export interface Aligned {
  caseIds: string[]; // cases used, in sorted order
  a: number[]; // 1 = candidate A passed, 0 = failed
  b: number[]; // same cases, same positions
  excluded: string[]; // dropped because of an API error on either side
  missing: string[]; // cases found for only one candidate
}

function indexByCase(rows: ScoreRow[], label: string): Map<string, ScoreRow> {
  const map = new Map<string, ScoreRow>();
  for (const row of rows) {
    if (map.has(row.caseId)) {
      throw new Error(`alignScores: duplicate case "${row.caseId}" in ${label}`);
    }
    map.set(row.caseId, row);
  }
  return map;
}

export function alignScores(rowsA: ScoreRow[], rowsB: ScoreRow[]): Aligned {
  const byA = indexByCase(rowsA, "candidate A");
  const byB = indexByCase(rowsB, "candidate B");

  // Every case id seen on either side, sorted so the output order is stable.
  const allIds = [...new Set([...byA.keys(), ...byB.keys()])].sort();

  const result: Aligned = { caseIds: [], a: [], b: [], excluded: [], missing: [] };

  for (const id of allIds) {
    const ra = byA.get(id);
    const rb = byB.get(id);

    if (!ra || !rb) {
      result.missing.push(id);
      continue;
    }
    if (ra.failure === "api_error" || rb.failure === "api_error") {
      result.excluded.push(id);
      continue;
    }

    result.caseIds.push(id);
    result.a.push(ra.passed ? 1 : 0);
    result.b.push(rb.passed ? 1 : 0);
  }

  return result;
}