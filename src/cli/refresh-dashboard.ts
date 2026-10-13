import type { Command } from "commander";
import { join } from "node:path";
import { exportRun } from "./export";
import { runConfiguredSuite, type RunOpts } from "./run";

interface RefreshDashboardOpts extends Omit<RunOpts, "split"> {
  dashboardDir: string;
}

export function registerRefreshDashboard(program: Command): void {
  program
    .command("refresh-dashboard")
    .description("Run dev and test evaluations, then refresh dashboard JSON")
    .option("--config <path>", "candidate config", "examples/hdb/config.yaml")
    .option("--cases <dir>", "case YAML directory", "examples/hdb/cases")
    .option("--expected <path>", "expected results file", "examples/hdb/expected.json")
    .option("--db <path>", "HDB SQLite database", "examples/hdb/hdb.db")
    .option("--results <path>", "results database", "examples/hdb/results.db")
    .option("--concurrency <n>", "parallel model calls", "4")
    .option("--dashboard-dir <path>", "dashboard data directory", "dashboard/data")
    .action(async (opts: RefreshDashboardOpts) => {
      for (const split of ["dev", "test"] as const) {
        console.log(`\n=== ${split.toUpperCase()} evaluation ===`);
        const runId = await runConfiguredSuite({ ...opts, split });
        exportRun(runId, join(opts.dashboardDir, `${split}.json`), opts.results);
      }

      console.log(`\nDashboard data refreshed in ${opts.dashboardDir}`);
    });
}
