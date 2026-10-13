import type { Command } from "commander";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { openResultsDb } from "../db/results";

interface RunRow {
  run_id: string;
  started_at: string;
  split: string;
  case_count: number;
}

interface CandidateRow {
  candidate: string;
  model: string;
  prompt_path: string;
}

interface ScoreRow {
  passed: number;
  failure: string | null;
  latency_ms: number | null;
  cost_usd: number | null;
}

export function registerExport(program: Command): void {
  program
    .command("export")
    .description("Export one saved run as dashboard JSON")
    .requiredOption("--run <id>", "run ID to export")
    .requiredOption("--out <path>", "output JSON file")
    .option("--results <path>", "results database", "examples/hdb/results.db")
    .action((opts: { run: string; out: string; results: string }) => {
      const db = openResultsDb(opts.results);

      try {
        const run = db
          .prepare("SELECT run_id, started_at, split, case_count FROM runs WHERE run_id = ?")
          .get(opts.run) as RunRow | undefined;

        if (!run) {
          throw new Error(`Unknown run ID: ${opts.run}`);
        }

        const candidates = db
          .prepare(`
            SELECT candidate, model, prompt_path
            FROM run_candidates
            WHERE run_id = ?
            ORDER BY candidate
          `)
          .all(opts.run) as CandidateRow[];

        if (candidates.length === 0) {
          throw new Error(
            `Run ${opts.run} has no saved candidate metadata. Rerun it with the updated code first.`,
          );
        }

        const exportedCandidates = candidates.map((candidate) => {
          const scores = db
            .prepare(`
              SELECT passed, failure, latency_ms, cost_usd
              FROM scores
              WHERE run_id = ? AND candidate = ?
            `)
            .all(opts.run, candidate.candidate) as ScoreRow[];

          const failures: Record<string, number> = {};
          for (const score of scores) {
            if (score.failure) {
              failures[score.failure] = (failures[score.failure] ?? 0) + 1;
            }
          }

          const called = scores.filter((score) => score.latency_ms !== null);
          const costs = called.map((score) => score.cost_usd);

          return {
            name: candidate.candidate,
            model: candidate.model,
            prompt: candidate.prompt_path,
            passed: scores.filter((score) => score.passed === 1).length,
            total: scores.length,
            latency: called.length
              ? Math.round(
                  called.reduce((sum, score) => sum + (score.latency_ms ?? 0), 0) /
                    called.length,
                )
              : null,
            cost:
              costs.length > 0 && costs.every((cost) => cost !== null)
                ? costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0)
                : null,
            failures,
          };
        });

        const output = {
          split: run.split,
          cases: run.case_count,
          runId: run.run_id,
          startedAt: run.started_at,
          candidates: exportedCandidates,
        };

        const outputPath = resolve(opts.out);
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
        console.log(`Exported run ${run.run_id} to ${outputPath}`);
      } finally {
        db.close();
      }
    });
}