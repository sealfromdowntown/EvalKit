import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CaseSchema } from "../cases/schema";
import { computeExpected, type ExpectedFile } from "../cases/expected";
import { openResultsDb } from "../db/results";
import { FakeClient } from "../llm/fake";
import type { ModelClient } from "../llm/types";
import type { ResolvedCandidate } from "../config/load";
import { runSuite } from "./run";
import { summarize } from "./summary";

let dir: string;
let hdbPath: string;
let expected: ExpectedFile;

const cases = [
  CaseSchema.parse({
    id: "count-tampines",
    question: "How many transactions in Tampines?",
    reference_sql: "SELECT COUNT(*) FROM resale WHERE town = 'TAMPINES'",
  }),
  CaseSchema.parse({
    id: "max-price",
    question: "What is the highest price overall?",
    reference_sql: "SELECT MAX(resale_price) FROM resale",
  }),
  CaseSchema.parse({
    id: "geylang-zero-count",
    question: "How many 1-room flats were resold in Geylang in 2018?",
    reference_sql: "SELECT COUNT(*) FROM resale WHERE town = 'GEYLANG' AND flat_type = '1 ROOM' AND month LIKE '2018-%'",
    intent_probe: {
      rows: [
        { month: "2018-01", town: "GEYLANG", flat_type: "1 ROOM" },
        { month: "2018-01", town: "TAMPINES", flat_type: "1 ROOM" },
        { month: "2018-01", town: "TAMPINES", flat_type: "1 ROOM" },
        { month: "2018-01", town: "GEYLANG", flat_type: "2 ROOM" },
        { month: "2019-01", town: "GEYLANG", flat_type: "1 ROOM" },
      ],
    },
  }),
];

const candidate = (name: string, model: string): ResolvedCandidate => ({
  name,
  provider: "openai",
  model,
  promptPath: "unused",
  promptText: "You write SQL.",
  maxCompletionTokens: 500,
});

const goodReply = (user: string) =>
  user.includes("Tampines")
    ? "```sql\nSELECT COUNT(*) FROM resale WHERE town = 'TAMPINES';\n```"
    : user.includes("Geylang")
      ? "SELECT COUNT(*) FROM resale WHERE town = 'GEYLANG' AND flat_type = '1 ROOM' AND month LIKE '2018-%'"
    : "SELECT MAX(resale_price) FROM resale";

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "evalkit-run-"));
  hdbPath = join(dir, "hdb.db");
  const db = new Database(hdbPath);
  db.exec("CREATE TABLE resale (month TEXT, town TEXT, flat_type TEXT, resale_price INTEGER)");
  const insert = db.prepare("INSERT INTO resale VALUES (?, ?, ?, ?)");
  insert.run("2024-01", "TAMPINES", "4 ROOM", 500000);
  insert.run("2024-02", "TAMPINES", "4 ROOM", 600000);
  insert.run("2024-03", "BEDOK", "3 ROOM", 400000);
  db.close();
  expected = await computeExpected(cases, hdbPath);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

describe("runSuite", () => {
  it("scores a good and a bad candidate", async () => {
    const db = openResultsDb(":memory:");
    const client = new FakeClient((req) =>
      req.model === "good-model" ? goodReply(req.user) : "SELECT 0",
    );
    const { scores } = await runSuite({
      db, client, cases, expected, hdbDbPath: hdbPath, split: "dev",
      candidates: [candidate("good", "good-model"), candidate("bad", "bad-model")],
    });
    const summary = Object.fromEntries(summarize(scores).map((s) => [s.candidate, s]));
    expect(summary.good.passed).toBe(3);
    expect(summary.bad.passed).toBe(0);
    expect(summary.bad.failures["wrong_result"]).toBe(2);
    expect(summary.bad.failures["intent_probe_failed"]).toBe(1);
  });

  it("makes zero API calls when rerun with a warm cache", async () => {
    const db = openResultsDb(":memory:");
    const client = new FakeClient((req) => goodReply(req.user));
    const args = {
      db, client, cases, expected, hdbDbPath: hdbPath, split: "dev",
      candidates: [candidate("good", "good-model")],
    };
    await runSuite(args);
    expect(client.calls).toBe(3);
    const second = await runSuite(args);
    expect(client.calls).toBe(3);
    expect(second.scores.every((s) => s.cached)).toBe(true);
  });

  it("records API failures instead of crashing", async () => {
    const db = openResultsDb(":memory:");
    const broken: ModelClient = {
      complete: async () => {
        throw new Error("boom");
      },
    };
    const { scores } = await runSuite({
      db, client: broken, cases, expected, hdbDbPath: hdbPath, split: "dev",
      candidates: [candidate("broken", "x")],
    });
    expect(scores.every((s) => s.failure === "api_error")).toBe(true);
    expect(summarize(scores)[0].apiErrors).toBe(3);
  });

  it("fails a zero-answer case when a wrong town filter only matches by accident", async () => {
    const db = openResultsDb(":memory:");
    const wrongTownSql = "SELECT COUNT(*) FROM resale WHERE town = 'GEYLING' AND flat_type = '1 ROOM' AND month LIKE '2018-%'";
    const client = new FakeClient((req) => req.user.includes("Geylang") ? wrongTownSql : goodReply(req.user));
    const { scores } = await runSuite({
      db, client, cases, expected, hdbDbPath: hdbPath, split: "dev",
      candidates: [candidate("typo", "typo-model")],
    });
    const score = scores.find((item) => item.caseId === "geylang-zero-count");
    expect(score?.passed).toBe(false);
    expect(score?.failure).toBe("intent_probe_failed");
    expect(score?.actualPreview).toContain("0");
  });

  it("refuses to run against stale expected results", async () => {
    const db = openResultsDb(":memory:");
    const stale: ExpectedFile = {
      ...expected,
      cases: { ...expected.cases, "max-price": { ...expected.cases["max-price"], sqlHash: "old" } },
    };
    await expect(
      runSuite({
        db, client: new FakeClient(), cases, expected: stale, hdbDbPath: hdbPath, split: "dev",
        candidates: [candidate("a", "m")],
      }),
    ).rejects.toThrow(/stale/);
  });
});
