import type { Command } from "commander";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { openResultsDb } from "../db/results";
import { loadCases } from "../cases/load";
import type { ExpectedFile } from "../cases/expected";

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
  case_id: string;
  candidate: string;
  passed: number;
  failure: string | null;
  detail: string | null;
  model_sql: string | null;
  actual_preview: string | null;
  latency_ms: number | null;
  cost_usd: number | null;
}

export function exportRun(
  runId: string,
  outPath: string,
  resultsPath: string,
  casesDir = "examples/hdb/cases",
  expectedPath = "examples/hdb/expected.json",
): void {
  const db = openResultsDb(resultsPath);

  try {
    const run = db
      .prepare("SELECT run_id, started_at, split, case_count FROM runs WHERE run_id = ?")
      .get(runId) as RunRow | undefined;

    if (!run) {
      throw new Error(`Unknown run ID: ${runId}`);
    }

    const candidates = db
      .prepare(`
            SELECT candidate, model, prompt_path
            FROM run_candidates
            WHERE run_id = ?
            ORDER BY candidate
          `)
      .all(runId) as CandidateRow[];

    if (candidates.length === 0) {
      throw new Error(
        `Run ${runId} has no saved candidate metadata. Rerun it with the updated code first.`,
      );
    }

    const allScores = db
      .prepare(`
        SELECT case_id, candidate, passed, failure, detail, model_sql, actual_preview,
               latency_ms, cost_usd
        FROM scores
        WHERE run_id = ?
      `)
      .all(runId) as ScoreRow[];

    const exportedCandidates = candidates.map((candidate) => {
      const scores = allScores.filter((score) => score.candidate === candidate.candidate);

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
        prompt: relative(process.cwd(), candidate.prompt_path).replaceAll("\\", "/"),
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

    const cases = loadCases(casesDir).filter((item) => item.split === run.split);
    const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as ExpectedFile;
    const caseResults = cases.map((item) => {
      const result = expected.cases[item.id];
      if (!result) throw new Error(`No expected result for case "${item.id}" in ${expectedPath}`);
      return {
        id: item.id,
        question: item.question,
        tags: item.tags,
        referenceSql: item.reference_sql,
        expected: { columns: result.columns, rows: result.rows },
        candidates: candidates.map((candidate) => {
          const score = allScores.find(
            (entry) => entry.case_id === item.id && entry.candidate === candidate.candidate,
          );
          return score
            ? {
                name: candidate.candidate,
                passed: score.passed === 1,
                failure: score.failure,
                detail: score.detail,
                modelSql: score.model_sql,
                actualPreview: score.actual_preview,
              }
            : {
                name: candidate.candidate,
                passed: false,
                failure: "missing_score",
                detail: "No score was saved for this candidate and case.",
                modelSql: null,
                actualPreview: null,
              };
        }),
      };
    });

    const output = {
      split: run.split,
      cases: run.case_count,
      runId: run.run_id,
      startedAt: run.started_at,
      candidates: exportedCandidates,
      caseResults,
    };

    const outputPath = resolve(outPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`Exported run ${run.run_id} to ${outputPath}`);
  } finally {
    db.close();
  }
}

export function registerExport(program: Command): void {
  program
    .command("export")
    .description("Export one saved run as dashboard JSON")
    .requiredOption("--run <id>", "run ID to export")
    .requiredOption("--out <path>", "output JSON file")
    .option("--results <path>", "results database", "examples/hdb/results.db")
    .option("--cases <dir>", "case YAML directory", "examples/hdb/cases")
    .option("--expected <path>", "expected results file", "examples/hdb/expected.json")
    .action((opts: { run: string; out: string; results: string; cases: string; expected: string }) => {
      exportRun(opts.run, opts.out, opts.results, opts.cases, opts.expected);
    });
}
