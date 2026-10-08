import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeSql } from "./index";

let dir: string;
let dbPath: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "evalkit-"));
  dbPath = join(dir, "test.db");
  const db = new Database(dbPath);
  db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
  const ins = db.prepare("INSERT INTO t VALUES (?, ?)");
  for (let i = 1; i <= 5; i++) ins.run(i, `n${i}`);
  db.close();
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const count = () => {
  const db = new Database(dbPath, { readonly: true });
  const n = (db.prepare("SELECT COUNT(*) AS n FROM t").get() as { n: number }).n;
  db.close();
  return n;
};

describe("executeSql", () => {
  it("runs a simple SELECT", async () => {
    const r = await executeSql("SELECT id, name FROM t ORDER BY id", { dbPath });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.columns).toEqual(["id", "name"]);
      expect(r.rows).toHaveLength(5);
      expect(r.truncated).toBe(false);
    }
  });

  it("allows WITH ... SELECT and a trailing semicolon", async () => {
    const r = await executeSql("WITH x AS (SELECT 1 AS a) SELECT a FROM x;", { dbPath });
    expect(r.ok).toBe(true);
  });

  it("caps the number of rows", async () => {
    const r = await executeSql("SELECT * FROM t", { dbPath, maxRows: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toHaveLength(2);
      expect(r.truncated).toBe(true);
    }
  });

  it("rejects DROP TABLE and leaves the table intact", async () => {
    const r = await executeSql("DROP TABLE t", { dbPath });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("rejected");
    expect(count()).toBe(5);
  });

  it("rejects multiple statements", async () => {
    const r = await executeSql("SELECT 1; DROP TABLE t", { dbPath });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("rejected");
    expect(count()).toBe(5);
  });

  it("rejects INSERT and leaves the data unchanged", async () => {
    const r = await executeSql("INSERT INTO t VALUES (99, 'x')", { dbPath });
    expect(r.ok).toBe(false);
    expect(count()).toBe(5);
  });

  it("times out a runaway query", async () => {
    const start = Date.now();
    const r = await executeSql(
      "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT COUNT(*) FROM c",
      { dbPath, timeoutMs: 1000 },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("timeout");
    expect(Date.now() - start).toBeLessThan(3000);
  });

  it("reports SQL errors without throwing", async () => {
    const r = await executeSql("SELECT nonexistent FROM t", { dbPath });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("sql_error");
  });
});