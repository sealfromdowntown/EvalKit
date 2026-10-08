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
    : "SELECT MAX(resale_price) FROM resale";

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "evalkit-run-"));
  hdbPath = join(dir, "hdb.db");
  const db = new Database(hdbPath);
  db.exec("CREATE TABLE resale (month TEXT, town TEXT, resale_price INTEGER)");
  const ins = db.prepare("INSERT INTO resale VALUES (?, ?, ?)");
  ins.run("2024-01", "TAMPINES", 500000);
  ins.run("2024-02", "TAMPINES", 600000);
  ins.run("2024-03", "BEDOK", 400000);
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
    expect(summary.good.passed).toBe(2);
    expect(summary.bad.passed).toBe(0);
    expect(summary.bad.failures["wrong_result"]).toBe(2);
  });

  it("makes zero API calls when rerun with a warm cache", async () => {
    const db = openResultsDb(":memory:");
    const client = new FakeClient((req) => goodReply(req.user));
    const args = {
      db, client, cases, expected, hdbDbPath: hdbPath, split: "dev",
      candidates: [candidate("good", "good-model")],
    };
    await runSuite(args);
    expect(client.calls).toBe(2);
    const second = await runSuite(args);
    expect(client.calls).toBe(2);
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
    expect(summarize(scores)[0].apiErrors).toBe(2);
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