import type { Command } from "commander";
import { openResultsDb } from "../db/results";
import { compareCandidates } from "../stats/compare";
import { latestRunWith, loadScores, runSplit } from "../stats/load";

interface CompareOpts {
  results: string;
  run?: string;
  resamples: string;
  seed: string;
}

const pts = (x: number): string => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`;
const pct = (k: number, n: number): string => `${((k / n) * 100).toFixed(1)}%`;

export function registerCompare(program: Command): void {
  program
    .command("compare <a> <b>")
    .description("Compare candidate B against candidate A on the same cases, with a confidence interval")
    .option("--results <path>", "results database", "examples/hdb/results.db")
    .option("--run <id>", "run id (default: latest run containing both candidates)")
    .option("--resamples <n>", "bootstrap resamples", "10000")
    .option("--seed <n>", "random seed", "12345")
    .action((a: string, b: string, opts: CompareOpts) => {
      if (a === b) throw new Error("Pick two different candidates to compare");

      const db = openResultsDb(opts.results);
      try {
        const runId = opts.run ?? latestRunWith(db, [a, b]);
        if (!runId) {
          throw new Error(
            `No run contains both "${a}" and "${b}". Check the names, or run the suite first.`,
          );
        }

        const rowsA = loadScores(db, runId, a);
        const rowsB = loadScores(db, runId, b);
        if (rowsA.length === 0) throw new Error(`"${a}" has no scores in run ${runId}`);
        if (rowsB.length === 0) throw new Error(`"${b}" has no scores in run ${runId}`);

        const c = compareCandidates(a, rowsA, b, rowsB, {
          resamples: Number.parseInt(opts.resamples, 10),
          seed: Number.parseInt(opts.seed, 10),
        });

        console.log(`Run: ${runId} (split: ${runSplit(db, runId)})`);
        console.log(
          `Comparing ${b} (B) against ${a} (A) on ${c.n} cases ` +
            `(${c.excluded.length} excluded for API errors, ${c.missing.length} missing)\n`,
        );
        console.log(`  A  ${a}: ${c.passedA}/${c.n} passed (${pct(c.passedA, c.n)})`);
        console.log(`  B  ${b}: ${c.passedB}/${c.n} passed (${pct(c.passedB, c.n)})\n`);
        console.log(
          `B fixed ${c.fixed.length} case(s), broke ${c.broken.length}, tied on ${c.ties}`,
        );
        console.log(`Mean difference (B minus A): ${pts(c.interval.mean)} points`);
        console.log(
          `${(c.interval.confidence * 100).toFixed(0)}% interval: ` +
            `${pts(c.interval.lower)} to ${pts(c.interval.upper)} points ` +
            `(${c.interval.resamples} resamples)\n`,
        );

        if (c.significant && c.interval.lower > 0) {
          console.log(`Verdict: ${b} is better than ${a}. The interval is entirely above zero.`);
        } else if (c.significant) {
          console.log(`Verdict: ${b} is worse than ${a}. The interval is entirely below zero.`);
        } else {
          console.log(
            "Verdict: not significant. The interval includes zero, so this sample cannot tell the two apart.",
          );
        }
        if (c.ties === c.n) {
          console.log("Note: every case tied, so the interval has no width. That is not evidence the two are equal.");
        }
        if (c.excluded.length / (c.n + c.excluded.length) > 0.1) {
          console.log("Warning: over 10% of cases were excluded for API errors. Rerun to retry them.");
        }

        if (c.fixed.length > 0) console.log(`\nFixed by ${b}:\n  ${c.fixed.join("\n  ")}`);
        if (c.broken.length > 0) console.log(`\nBroken by ${b}:\n  ${c.broken.join("\n  ")}`);
      } finally {
        db.close();
      }
    });
}