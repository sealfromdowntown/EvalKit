import { displayFlatType, displayTown } from "./names";
import { medianSql, sqlString } from "./sql";

export interface Universe {
  towns: string[];
  flatTypes: string[];
  years: number[];
}

/** A candidate case, plus the queries the generator uses to vet it. */
export interface Draft {
  id: string;
  question: string;
  sql: string;
  tags: string[];
  /** Returns one number: how many rows the answer is based on. */
  supportSql: string;
  minSupport: number;
  /** Optional: returns 1 when the answer is unambiguous (no tie), else 0. */
  tieSql?: string;
}

export interface Template {
  name: string;
  quota: number;
  drafts(u: Universe): Draft[];
}

interface Filter {
  town?: string;
  flatType?: string;
  year?: number;
}

function whereFor(f: Filter): string {
  const parts: string[] = [];
  if (f.town !== undefined) parts.push(`town = ${sqlString(f.town)}`);
  if (f.flatType !== undefined) parts.push(`flat_type = ${sqlString(f.flatType)}`);
  if (f.year !== undefined) parts.push(`month LIKE '${f.year}%'`);
  return parts.join(" AND ");
}

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

type TownFlatYear = { town: string; flatType: string; year: number };
type TownYear = { town: string; year: number };
type FlatYear = { flatType: string; year: number };
type YearOnly = { year: number };

const townFlatYear = (u: Universe): TownFlatYear[] =>
  u.towns.flatMap((town) =>
    u.flatTypes.flatMap((flatType) => u.years.map((year) => ({ town, flatType, year }))),
  );
const townYear = (u: Universe): TownYear[] =>
  u.towns.flatMap((town) => u.years.map((year) => ({ town, year })));
const flatYear = (u: Universe): FlatYear[] =>
  u.flatTypes.flatMap((flatType) => u.years.map((year) => ({ flatType, year })));
const yearOnly = (u: Universe): YearOnly[] => u.years.map((year) => ({ year }));

function define<P>(
  name: string,
  quota: number,
  combos: (u: Universe) => P[],
  build: (p: P) => Draft,
): Template {
  return { name, quota, drafts: (u) => combos(u).map(build) };
}

/** Shared shape for the town + flat type + year templates. */
function tfyDraft(
  kind: string,
  p: TownFlatYear,
  question: string,
  sql: (where: string) => string,
  tags: string[],
): Draft {
  const w = whereFor(p);
  return {
    id: `gen-${kind}-${slug(p.town)}-${slug(p.flatType)}-${p.year}`,
    question,
    sql: sql(w),
    tags: ["single-table", ...tags, "generated"],
    supportSql: `SELECT COUNT(*) FROM resale WHERE ${w}`,
    minSupport: 30,
  };
}

export const templates: Template[] = [
  define("count-town-year", 10, townYear, (p) => {
    const w = whereFor(p);
    return {
      id: `gen-count-${slug(p.town)}-${p.year}`,
      question: `How many resale transactions were there in ${displayTown(p.town)} in ${p.year}?`,
      sql: `SELECT COUNT(*) FROM resale\nWHERE ${w}`,
      tags: ["single-table", "count", "generated"],
      supportSql: `SELECT COUNT(*) FROM resale WHERE ${w}`,
      minSupport: 50,
    };
  }),

  define("avg-price", 10, townFlatYear, (p) =>
    tfyDraft(
      "avg",
      p,
      `What was the average resale price of ${displayFlatType(p.flatType)} flats in ${displayTown(p.town)} in ${p.year}?`,
      (w) => `SELECT AVG(resale_price) FROM resale\nWHERE ${w}`,
      ["average"],
    ),
  ),

  define("median-price", 10, townFlatYear, (p) =>
    tfyDraft(
      "median",
      p,
      `What was the median resale price of ${displayFlatType(p.flatType)} flats in ${displayTown(p.town)} in ${p.year}?`,
      (w) => medianSql(w),
      ["median"],
    ),
  ),

  define("max-price", 8, townFlatYear, (p) =>
    tfyDraft(
      "max",
      p,
      `What was the highest resale price for ${displayFlatType(p.flatType)} flats in ${displayTown(p.town)} in ${p.year}?`,
      (w) => `SELECT MAX(resale_price) FROM resale\nWHERE ${w}`,
      ["max"],
    ),
  ),

  define("price-per-sqm", 8, townFlatYear, (p) =>
    tfyDraft(
      "sqm",
      p,
      `What was the average price per square metre for ${displayFlatType(p.flatType)} flats in ${displayTown(p.town)} in ${p.year}?`,
      (w) => `SELECT AVG(resale_price / floor_area_sqm) FROM resale\nWHERE ${w}`,
      ["average", "derived-metric"],
    ),
  ),

  define("count-flat-type-year", 6, flatYear, (p) => {
    const w = whereFor(p);
    return {
      id: `gen-count-flat-${slug(p.flatType)}-${p.year}`,
      question: `How many ${displayFlatType(p.flatType)} flats were sold in ${p.year}?`,
      sql: `SELECT COUNT(*) FROM resale\nWHERE ${w}`,
      tags: ["single-table", "count", "generated"],
      supportSql: `SELECT COUNT(*) FROM resale WHERE ${w}`,
      minSupport: 50,
    };
  }),

  define("top-town-year", 4, yearOnly, (p) => {
    const w = whereFor(p);
    const counts = `SELECT COUNT(*) FROM resale WHERE ${w} GROUP BY town ORDER BY COUNT(*) DESC`;
    return {
      id: `gen-top-town-${p.year}`,
      question: `Which town had the most resale transactions in ${p.year}?`,
      sql: `SELECT town FROM resale\nWHERE ${w}\nGROUP BY town\nORDER BY COUNT(*) DESC\nLIMIT 1`,
      tags: ["single-table", "group-by", "generated"],
      supportSql: `SELECT COUNT(*) FROM resale WHERE ${w}`,
      minSupport: 1000,
      tieSql: `SELECT CASE WHEN (${counts} LIMIT 1) > (${counts} LIMIT 1 OFFSET 1) THEN 1 ELSE 0 END`,
    };
  }),
];