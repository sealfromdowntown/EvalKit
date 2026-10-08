import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { CaseFileSchema, type Case } from "./schema";
import { validateSelect } from "../executor/index";

export function loadCases(dir: string): Case[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  const all: Case[] = [];
  for (const f of files) {
    const raw = parse(readFileSync(join(dir, f), "utf8"));
    const parsed = CaseFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid cases in ${f}:\n${z.prettifyError(parsed.error)}`);
    }
    all.push(...parsed.data);
  }

  const seen = new Set<string>();
  for (const c of all) {
    if (seen.has(c.id)) throw new Error(`Duplicate case id: ${c.id}`);
    seen.add(c.id);
    const v = validateSelect(c.reference_sql);
    if (!v.ok) throw new Error(`Case ${c.id}: reference_sql rejected: ${v.message}`);
  }
  return all;
}