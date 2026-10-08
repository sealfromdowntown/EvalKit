import type { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { loadCases } from "../cases/load";
import type { ExpectedFile } from "../cases/expected";
import { loadConfig } from "../config/load";
import { openResultsDb } from "../db/results";
import { OpenAIClient } from "../llm/openai";
import { runSuite } from "../runner/run";
import { summarize } from "../runner/summary";

interface RunOpts {
  config: string;
  cases: string;
  expected: string;
  db: string;
  results: string;
  split: string;
  concurrency: string;
  showFailures?: boolean;
}

export function registerRun(program: Command): void {
  program
    .command("run")
    .description("Run every candidate on every case and score the results")
    .option("--config <path>", "candidate config", "examples/hdb/config.yaml")
    .option("--cases <dir>", "case YAML directory", "examples/hdb/cases")
    .option("--expected <path>", "expected results file", "examples/hdb/expected.json")
    .option("--db <path>", "HDB SQLite database", "examples/hdb/hdb.db")
    .option("--results <path>", "results database", "examples/hdb/results.db")
    .option("--split <split>", "dev | test | all (test is the held-out set)", "dev")
    .option("--concurrency <n>", "parallel model calls", "4")
    .option("--show-failures", "list each failed case")
    .action(async (opts: RunOpts) => {
      if (!["dev", "test", "all"].includes(opts.split)) {
        throw new Error(`--split must be dev, test or all (got "${opts.split}")`);
      }
      const candidates = loadConfig(opts.config);
      const all = loadCases(opts.cases);
      const cases = opts.split === "all" ? all : all.filter((c) => c.split === opts.split);
      if (cases.length === 0) throw new Error(`No cases in split "${opts.split}"`);
      if (!existsSync(opts.expected)) throw new Error("No expected results. Run: compute-expected");
      const expected = JSON.parse(readFileSync(opts.expected, "utf8")) as ExpectedFile;

      const total = candidates.length * cases.length;
      console.log(
        `Running ${candidates.length} candidate(s) x ${cases.length} case(s) = ${total} calls (cached calls are free)`,
      );

      const db = openResultsDb(opts.results);
      const { runId, scores } = await runSuite({
        db,
        client: new OpenAIClient(),
        candidates,
        cases,
        expected,
        hdbDbPath: opts.db,
        split: opts.split,
        concurrency: Number.parseInt(opts.concurrency, 10) || 4,
        onProgress: (done, t) => process.stdout.write(`\r  ${done}/${t}`),
      });
      process.stdout.write("\n\n");

      const summaries = summarize(scores);
      console.table(
        summaries.map((s) => ({
          candidate: s.candidate,
          passed: `${s.passed}/${s.total}`,
          accuracy: `${(s.accuracy * 100).toFixed(1)}%`,
          api_errors: s.apiErrors,
          avg_latency_ms: s.avgLatencyMs ?? "n/a",
          tokens_in: s.tokensIn,
          tokens_out: s.tokensOut,
          cost_usd: s.costUsd === null ? "n/a" : s.costUsd.toFixed(5),
        })),
      );

      for (const s of summaries) {
        const parts = Object.entries(s.failures).map(([k, v]) => `${k}: ${v}`);
        console.log(`${s.candidate} failures: ${parts.length ? parts.join(", ") : "none"}`);
      }

      if (opts.showFailures) {
        console.log("");
        for (const s of scores.filter((x) => !x.passed)) {
          console.log(`[${s.candidate}] ${s.caseId} (${s.failure})`);
          console.log(`  sql:    ${s.modelSql ?? "-"}`);
          console.log(`  detail: ${s.detail}`);
        }
      }

      console.log(`\nRun id: ${runId}`);
      db.close();
    });
}