import { describe, expect, it } from "vitest";
import { CaseSchema } from "./schema";
import { findCrossSplitSqlDuplicates } from "./split-integrity";

const makeCase = (id: string, split: "dev" | "test", reference_sql: string) =>
  CaseSchema.parse({
    id,
    split,
    question: `What is the answer for ${id}?`,
    reference_sql,
  });

describe("findCrossSplitSqlDuplicates", () => {
  it("finds matching reference SQL across dev and test despite whitespace", () => {
    const result = findCrossSplitSqlDuplicates([
      makeCase("dev-count", "dev", "SELECT COUNT(*) FROM resale"),
      makeCase("test-count", "test", "SELECT COUNT(*)\nFROM resale"),
    ]);

    expect(result).toEqual([
      {
        sqlHash: "777251e78b0867d7",
        devCaseIds: ["dev-count"],
        testCaseIds: ["test-count"],
      },
    ]);
  });

  it("does not report SQL that appears in only one split", () => {
    expect(
      findCrossSplitSqlDuplicates([
        makeCase("dev-count", "dev", "SELECT COUNT(*) FROM resale"),
        makeCase("test-average", "test", "SELECT AVG(resale_price) FROM resale"),
      ]),
    ).toEqual([]);
  });
});
