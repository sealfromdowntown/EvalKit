import { Command } from "commander";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadCases } from "../cases/load";
import { registerRun } from "./run";
import {
  computeExpected,
  hashSql,
  isEmptyResult,
  type ExpectedFile,
} from "../cases/expected";

const DEFAULTS = {
  cases: "examples/hdb/cases",
  db: "examples/hdb/hdb.db",
  expected: "examples/hdb/expected.json",
};

const program = new Command()
  .name("evalkit")
  .description("Evaluate LLM prompts and models with statistically rigorous comparisons");

program
  .command("compute-expected")
  .description("Run each case's reference SQL and store the expected results")
  .option("--cases <dir>", "directory of case YAML files", DEFAULTS.cases)
  .option("--db <path>", "SQLite database to query", DEFAULTS.db)
  .option("--out <path>", "where to write expected results", DEFAULTS.expected)
  .action(async (opts: { cases: string; db: string; out: string }) => {
    const cases = loadCases(opts.cases);
    const expected = await computeExpected(cases, opts.db);
    writeFileSync(opts.out, JSON.stringify(expected, null, 2) + "\n");
    console.log(`Wrote ${Object.keys(expected.cases).length} expected results to ${opts.out}`);
    console.log("Now run: validate");
  });

program
  .command("validate")
  .description("Check case files and compare them against stored expected results")
  .option("--cases <dir>", "directory of case YAML files", DEFAULTS.cases)
  .option("--expected <path>", "expected results file", DEFAULTS.expected)
  .action((opts: { cases: string; expected: string }) => {
    const cases = loadCases(opts.cases);
    console.log(`OK: ${cases.length} cases are valid`);

    if (!existsSync(opts.expected)) {
      console.log("No expected results yet. Run: compute-expected");
      return;
    }

    const exp = JSON.parse(readFileSync(opts.expected, "utf8")) as ExpectedFile;
    let problems = 0;

    for (const c of cases) {
      const e = exp.cases[c.id];
      if (!e) {
        console.log(`  MISSING expected result: ${c.id}`);
        problems++;
        continue;
      }
      if (e.sqlHash !== hashSql(c.reference_sql)) {
        console.log(`  STALE (reference SQL changed): ${c.id}`);
        problems++;
        continue;
      }
      const preview = JSON.stringify(e.rows.slice(0, 3));
      const warn = isEmptyResult(e) ? "   WARNING: EMPTY RESULT" : "";
      console.log(`  ${c.id} [${c.split}] -> ${preview}${warn}`);
    }

    for (const id of Object.keys(exp.cases)) {
      if (!cases.some((c) => c.id === id)) {
        console.log(`  ORPHANED expected result: ${id}`);
        problems++;
      }
    }

    const d = exp.dataset;
    console.log(`Dataset: ${d.rowCount} rows, ${d.firstMonth} to ${d.lastMonth}`);
    if (problems > 0) process.exitCode = 1;
  });
  
registerRun(program);
program.parseAsync(process.argv).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});