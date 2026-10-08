import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

export type ExecResult =
  | { ok: true; columns: string[]; rows: unknown[][]; truncated: boolean }
  | { ok: false; error: "rejected" | "timeout" | "sql_error"; message: string };

export interface ExecOptions {
  dbPath: string;
  timeoutMs?: number; // default 5000
  maxRows?: number; // default 1000
}

type Validation = { ok: true; sql: string } | { ok: false; message: string };

/**
 * Text-level check. The read-only connection is the real protection;
 * this exists to give clear error messages and to run exactly what we validated.
 * Comments are stripped before running, so a '--' or '/*' inside a string
 * literal would be altered. That is acceptable for this dataset.
 */
export function validateSelect(sql: string): Validation {
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim()
    .replace(/;+\s*$/, "")
    .trim();

  if (cleaned === "") return { ok: false, message: "Empty query" };
  if (!/^(select|with)\b/i.test(cleaned)) {
    return { ok: false, message: "Only SELECT queries are allowed" };
  }
  if (cleaned.includes(";")) {
    return { ok: false, message: "Only a single statement is allowed" };
  }
  return { ok: true, sql: cleaned };
}

export function executeSql(sql: string, opts: ExecOptions): Promise<ExecResult> {
  const check = validateSelect(sql);
  if (!check.ok) {
    return Promise.resolve({ ok: false, error: "rejected", message: check.message });
  }

  const { dbPath, timeoutMs = 5000, maxRows = 1000 } = opts;

  return new Promise((resolve) => {
    const child = fork(fileURLToPath(new URL("./child.mjs", import.meta.url)), [], {
      execArgv: [], // don't inherit tsx/vitest flags
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });

    let settled = false;
    const finish = (result: ExecResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Resolve only after the process is really gone, so the
      // database file is closed before the caller continues.
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve(result);
        return;
      }
      child.once("exit", () => resolve(result));
      child.kill("SIGKILL");
    };

    const timer = setTimeout(
      () => finish({ ok: false, error: "timeout", message: `Query exceeded ${timeoutMs} ms` }),
      timeoutMs,
    );

    child.once("message", (msg) => finish(msg as ExecResult));
    child.once("error", (e) => finish({ ok: false, error: "sql_error", message: e.message }));
    child.once("exit", (code) =>
      finish({
        ok: false,
        error: "sql_error",
        message: `Executor process exited unexpectedly (code ${code})`,
      }),
    );

    child.send({ dbPath, sql: check.sql, maxRows });
  });
}