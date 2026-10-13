import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Case } from "../cases/schema";
import { hashSql, type ExpectedFile } from "../cases/expected";
import type { ResolvedCandidate } from "../config/load";
import { executeSql } from "../executor/index";
import { extractSql } from "../llm/extract";
import type { ModelClient } from "../llm/types";
import { scoreExecution, type Failure } from "../scorers/execution";
import { cachedComplete } from "./call";
import { buildUserMessage, describeSchema } from "./prompt";

export interface CaseScore {
  candidate: string;
  caseId: string;
  passed: boolean;
  failure: Failure | null;
  detail: string;
  modelSql: string | null;
  actualPreview: string | null;
  cached: boolean;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
}

export interface RunOptions {
  db: Database.Database;
  client: ModelClient;
  candidates: ResolvedCandidate[];
  cases: Case[];
  expected: ExpectedFile;
  hdbDbPath: string;
  split: string;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

export function assertExpectedFresh(cases: Case[], expected: ExpectedFile): void {
  for (const c of cases) {
    const e = expected.cases[c.id];
    if (!e) throw new Error(`No expected result for case "${c.id}". Run: compute-expected`);
    if (e.sqlHash !== hashSql(c.reference_sql)) {
      throw new Error(
        `Expected result for "${c.id}" is stale (reference SQL changed). Run: compute-expected`,
      );
    }
  }
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

export async function runSuite(
  opts: RunOptions,
): Promise<{ runId: string; scores: CaseScore[] }> {
  const { db, client, candidates, cases, expected, hdbDbPath, split } = opts;
  assertExpectedFresh(cases, expected);

  const schema = describeSchema(hdbDbPath);
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 6)}`;

  db.prepare(
    "INSERT INTO runs (run_id, started_at, split, candidate_count, case_count) VALUES (?, ?, ?, ?, ?)",
  ).run(runId, new Date().toISOString(), split, candidates.length, cases.length);

  const insertRunCandidate = db.prepare(`
    INSERT INTO run_candidates
      (run_id, candidate, provider, model, prompt_path, prompt_hash, settings_json, price_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const candidate of candidates) {
    const promptHash = createHash("sha256")
      .update(candidate.promptText)
      .digest("hex");

    insertRunCandidate.run(
      runId,
      candidate.name,
      candidate.provider,
      candidate.model,
      candidate.promptPath,
      promptHash,
      JSON.stringify({
        maxCompletionTokens: candidate.maxCompletionTokens,
        temperature: candidate.temperature ?? null,
      }),
      candidate.pricePer1M ? JSON.stringify(candidate.pricePer1M) : null,
    );
  }
  

  const insertScore = db.prepare(
    `INSERT INTO scores
     (run_id, candidate, case_id, passed, failure, detail, model_sql, actual_preview,
      cached, latency_ms, tokens_in, tokens_out, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const runOne = async (candidate: ResolvedCandidate, c: Case): Promise<CaseScore> => {
    const blank: Omit<CaseScore, "passed" | "failure" | "detail"> = {
      candidate: candidate.name,
      caseId: c.id,
      modelSql: null,
      actualPreview: null,
      cached: false,
      latencyMs: null,
      tokensIn: null,
      tokensOut: null,
      costUsd: null,
    };

    let call;
    try {
      call = await cachedComplete(db, client, {
        candidate,
        question: c.question,
        user: buildUserMessage(schema, c.question),
      });
    } catch (e) {
      return {
        ...blank,
        passed: false,
        failure: "api_error",
        detail: e instanceof Error ? e.message : String(e),
      };
    }

    const withCall = {
      ...blank,
      cached: call.cached,
      latencyMs: call.latencyMs,
      tokensIn: call.tokensIn,
      tokensOut: call.tokensOut,
      costUsd: call.costUsd,
    };

    const sql = extractSql(call.text);
    if (sql === "") {
      return { ...withCall, passed: false, failure: "no_sql", detail: "Reply contained no SQL" };
    }

    const exec = await executeSql(sql, { dbPath: hdbDbPath });
    const result = scoreExecution(exec, expected.cases[c.id], c.compare);
    return {
      ...withCall,
      modelSql: sql,
      actualPreview: exec.ok ? JSON.stringify(exec.rows.slice(0, 5)) : null,
      passed: result.pass,
      failure: result.failure,
      detail: result.detail,
    };
  };

  const jobs = candidates.flatMap((candidate) => cases.map((c) => ({ candidate, c })));
  const scores: CaseScore[] = [];
  let done = 0;

  await pool(jobs, opts.concurrency ?? 4, async ({ candidate, c }) => {
    const s = await runOne(candidate, c);
    scores.push(s);
    insertScore.run(
      runId, s.candidate, s.caseId, s.passed ? 1 : 0, s.failure, s.detail, s.modelSql,
      s.actualPreview, s.cached ? 1 : 0, s.latencyMs, s.tokensIn, s.tokensOut, s.costUsd,
    );
    done++;
    opts.onProgress?.(done, jobs.length);
  });

  scores.sort((a, b) => a.candidate.localeCompare(b.candidate) || a.caseId.localeCompare(b.caseId));
  return { runId, scores };
}
