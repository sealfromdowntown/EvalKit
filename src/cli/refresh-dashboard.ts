import type { Command } from "commander";
import { join } from "node:path";
import { exportRun } from "./export";
import { runConfiguredSuite, type RunOpts } from "./run";
import { execFileSync } from "node:child_process";

interface RefreshDashboardOpts extends Omit<RunOpts, "split"> {
  dashboardDir: string;
}

function gitOutput(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitRun(...args: string[]): void {
  execFileSync("git", args, { stdio: "inherit" });
}

function publishDashboardData(): void {
  const branch = gitOutput("branch", "--show-current");
  if (branch !== "main") {
    throw new Error(`Publish from main, not "${branch}".`);
  }

  if (gitOutput("diff", "--cached", "--name-only")) {
    throw new Error("You have staged changes. Commit or unstage them before refreshing.");
  }

  gitRun("add", "--", "dashboard/data/dev.json", "dashboard/data/test.json");

  const changedFiles = gitOutput(
    "diff",
    "--cached",
    "--name-only",
    "--",
    "dashboard/data/dev.json",
    "dashboard/data/test.json",
  );

  if (!changedFiles) {
    console.log("Dashboard data is unchanged; nothing to publish.");
    return;
  }

  gitRun("commit", "-m", "chore: refresh dashboard data");
  gitRun("push", "origin", "main");
  console.log("Pushed dashboard data. GitHub Actions will deploy the dashboard.");
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
        exportRun(runId, join(opts.dashboardDir, `${split}.json`), opts.results, opts.cases, opts.expected);
      }

      console.log(`\nDashboard data refreshed in ${opts.dashboardDir}`);
      publishDashboardData();
    });
}
