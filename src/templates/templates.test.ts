import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { CaseSchema } from "../cases/schema";
import { templates, type Universe } from "./templates";

const universe: Universe = {
  towns: ["ANG MO KIO", "TAMPINES"],
  flatTypes: ["4 ROOM"],
  years: [2022, 2023],
};

let db: Database.Database;

beforeAll(() => {
  db = new Database(":memory:");
  db.exec(`CREATE TABLE resale (
    month TEXT, town TEXT, flat_type TEXT, resale_price INTEGER, floor_area_sqm REAL
  )`);
  const ins = db.prepare("INSERT INTO resale VALUES (?, ?, ?, ?, ?)");
  ins.run("2022-01", "TAMPINES", "4 ROOM", 500000, 90);
  ins.run("2022-02", "TAMPINES", "4 ROOM", 600000, 95);
  ins.run("2022-03", "BEDOK", "4 ROOM", 400000, 85);
  ins.run("2023-01", "TAMPINES", "4 ROOM", 520000, 90);
  ins.run("2023-02", "BEDOK", "4 ROOM", 410000, 85);
});

afterAll(() => db.close());

const allDrafts = () => templates.flatMap((t) => t.drafts(universe));

describe("templates", () => {
  it("produces unique ids across all templates", () => {
    const ids = allDrafts().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces drafts that satisfy the case schema", () => {
    for (const d of allDrafts()) {
      const r = CaseSchema.safeParse({
        id: d.id,
        question: d.question,
        reference_sql: d.sql,
        tags: d.tags,
      });
      expect(r.success, d.id).toBe(true);
    }
  });

  it("produces SQL that executes without errors", () => {
    for (const d of allDrafts()) {
      expect(() => db.prepare(d.sql).all(), d.id).not.toThrow();
      expect(() => db.prepare(d.supportSql).pluck().get(), d.id).not.toThrow();
      if (d.tieSql) expect(() => db.prepare(d.tieSql as string).pluck().get(), d.id).not.toThrow();
    }
  });

  it("writes questions in natural casing but filters on stored casing", () => {
    const count = templates
      .find((t) => t.name === "count-town-year")!
      .drafts(universe)
      .find((d) => d.id === "gen-count-ang-mo-kio-2022")!;
    expect(count.question).toContain("Ang Mo Kio");
    expect(count.sql).toContain("'ANG MO KIO'");
  });

  it("flags ties for the top-town question", () => {
    const drafts = templates.find((t) => t.name === "top-town-year")!.drafts(universe);
    const tie = (id: string) =>
      db.prepare(drafts.find((d) => d.id === id)!.tieSql as string).pluck().get();
    expect(tie("gen-top-town-2022")).toBe(1); // TAMPINES 2 vs BEDOK 1
    expect(tie("gen-top-town-2023")).toBe(0); // 1 vs 1: a tie
  });
});