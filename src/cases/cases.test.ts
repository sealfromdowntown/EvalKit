import { describe, it, expect } from "vitest";
import { CaseSchema } from "./schema";
import { hashSql, isZeroScalarResult } from "./expected";

const valid = {
  id: "count-tampines-2024",
  question: "How many transactions were there in Tampines in 2024?",
  reference_sql: "SELECT COUNT(*) FROM resale",
};

describe("CaseSchema", () => {
  it("accepts a valid case and applies defaults", () => {
    const r = CaseSchema.parse(valid);
    expect(r.split).toBe("dev");
    expect(r.tags).toEqual([]);
  });

  it("rejects unknown fields (typos)", () => {
    expect(CaseSchema.safeParse({ ...valid, refrence_sql: "x" }).success).toBe(false);
  });

  it("rejects bad ids", () => {
    expect(CaseSchema.safeParse({ ...valid, id: "Bad ID" }).success).toBe(false);
  });

  it("rejects an invalid split", () => {
    expect(CaseSchema.safeParse({ ...valid, split: "train" }).success).toBe(false);
  });
});

describe("hashSql", () => {
  it("ignores whitespace differences", () => {
    expect(hashSql("SELECT  1\n FROM t")).toBe(hashSql("SELECT 1 FROM t"));
  });

  it("changes when the query changes", () => {
    expect(hashSql("SELECT 1")).not.toBe(hashSql("SELECT 2"));
  });
});

describe("isZeroScalarResult", () => {
  it("flags a scalar zero answer for manual review", () => {
    expect(isZeroScalarResult({ sqlHash: "x", columns: ["COUNT(*)"], rows: [[0]] })).toBe(true);
  });

  it("does not flag nonzero or multi-cell results", () => {
    expect(isZeroScalarResult({ sqlHash: "x", columns: ["COUNT(*)"], rows: [[18]] })).toBe(false);
    expect(isZeroScalarResult({ sqlHash: "x", columns: ["a", "b"], rows: [[0, 1]] })).toBe(false);
  });
});
