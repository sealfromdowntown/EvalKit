import type { Case } from "./schema";
import { hashSql } from "./expected";

export interface CrossSplitSqlDuplicate {
  sqlHash: string;
  devCaseIds: string[];
  testCaseIds: string[];
}

export function findCrossSplitSqlDuplicates(cases: Case[]): CrossSplitSqlDuplicate[] {
  const byHash = new Map<string, { devCaseIds: string[]; testCaseIds: string[] }>();

  for (const item of cases) {
    const sqlHash = hashSql(item.reference_sql);
    const ids = byHash.get(sqlHash) ?? { devCaseIds: [], testCaseIds: [] };
    (item.split === "test" ? ids.testCaseIds : ids.devCaseIds).push(item.id);
    byHash.set(sqlHash, ids);
  }

  return [...byHash.entries()]
    .filter(([, ids]) => ids.devCaseIds.length > 0 && ids.testCaseIds.length > 0)
    .map(([sqlHash, ids]) => ({ sqlHash, ...ids }));
}
