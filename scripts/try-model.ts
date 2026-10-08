import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadCases } from "../src/cases/load";
import type { ExpectedFile } from "../src/cases/expected";
import { loadConfig } from "../src/config/load";
import { openResultsDb } from "../src/db/results";
import { executeSql } from "../src/executor/index";
import { extractSql } from "../src/llm/extract";
import { OpenAIClient } from "../src/llm/openai";
import { cachedComplete } from "../src/runner/call";
import { buildUserMessage, describeSchema } from "../src/runner/prompt";

const p = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const expectedPath = p("examples/hdb/expected.json");
if (!existsSync(expectedPath)) {
  console.error("Run compute-expected first (Step 5).");
  process.exit(1);
}

const candidate = loadConfig(p("examples/hdb/config.yaml"))[0];
const c = loadCases(p("examples/hdb/cases"))[0];
const expected = (JSON.parse(readFileSync(expectedPath, "utf8")) as ExpectedFile).cases[c.id];

const db = openResultsDb(p("examples/hdb/results.db"));
const schema = describeSchema(p("examples/hdb/hdb.db"));
const user = buildUserMessage(schema, c.question);

const r = await cachedComplete(db, new OpenAIClient(), { candidate, question: c.question, user });
console.log(`candidate: ${candidate.name} (${candidate.model})`);
console.log(`question:  ${c.question}`);
console.log(`cached: ${r.cached} | latency: ${r.latencyMs} ms | tokens in/out: ${r.tokensIn}/${r.tokensOut} | cost: ${r.costUsd}`);
console.log("raw reply:\n" + r.text);

const sql = extractSql(r.text);
const exec = await executeSql(sql, { dbPath: p("examples/hdb/hdb.db") });
console.log("\nexecution:", JSON.stringify(exec));
console.log("expected: ", JSON.stringify(expected.rows));
console.log("naive match:", exec.ok && JSON.stringify(exec.rows) === JSON.stringify(expected.rows));