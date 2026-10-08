import Database from "better-sqlite3";
import { parse } from "csv-parse/sync";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const csvPath = fileURLToPath(new URL("./data/resale_2017_onwards.csv", import.meta.url));
const dbPath = fileURLToPath(new URL("./hdb.db", import.meta.url));

const EXPECTED_COLUMNS = [
  "month", "town", "flat_type", "block", "street_name", "storey_range",
  "floor_area_sqm", "flat_model", "lease_commence_date", "remaining_lease", "resale_price",
];

if (!existsSync(csvPath)) {
  console.error(`CSV not found at ${csvPath}`);
  process.exit(1);
}

const rows: Record<string, string>[] = parse(readFileSync(csvPath, "utf8"), {
  columns: true,
  skip_empty_lines: true,
  bom: true,
});

// Fail loudly if the file's columns aren't what we expect
const actual = Object.keys(rows[0]);
const missing = EXPECTED_COLUMNS.filter((c) => !actual.includes(c));
if (missing.length > 0) {
  console.error("Missing expected columns:", missing, "\nFound:", actual);
  process.exit(1);
}

// Rebuild from scratch every time so the setup is reproducible
if (existsSync(dbPath)) rmSync(dbPath);
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE resale (
    month               TEXT    NOT NULL,   -- 'YYYY-MM'
    town                TEXT    NOT NULL,
    flat_type           TEXT    NOT NULL,
    block               TEXT    NOT NULL,
    street_name         TEXT    NOT NULL,
    storey_range        TEXT    NOT NULL,   -- bucket, e.g. '10 TO 12'
    floor_area_sqm      REAL    NOT NULL,
    flat_model          TEXT    NOT NULL,
    lease_commence_date INTEGER NOT NULL,
    remaining_lease     TEXT,               -- e.g. '61 years 04 months'
    resale_price        INTEGER NOT NULL
  );
`);

const insert = db.prepare(`
  INSERT INTO resale VALUES (
    @month, @town, @flat_type, @block, @street_name, @storey_range,
    @floor_area_sqm, @flat_model, @lease_commence_date, @remaining_lease, @resale_price
  )
`);

const load = db.transaction((all: Record<string, string>[]) => {
  for (const r of all) {
    insert.run({
      month: r.month,
      town: r.town,
      flat_type: r.flat_type,
      block: r.block,
      street_name: r.street_name,
      storey_range: r.storey_range,
      floor_area_sqm: Number(r.floor_area_sqm),
      flat_model: r.flat_model,
      lease_commence_date: Number(r.lease_commence_date),
      remaining_lease: r.remaining_lease || null,
      resale_price: Number(r.resale_price),
    });
  }
});
load(rows);

db.exec(`
  CREATE INDEX idx_resale_town ON resale(town);
  CREATE INDEX idx_resale_flat_type ON resale(flat_type);
  CREATE INDEX idx_resale_month ON resale(month);
`);

// --- Report so you can inspect the data ---
const count = (db.prepare("SELECT COUNT(*) AS n FROM resale").get() as { n: number }).n;
console.log(`Loaded ${count} rows into ${dbPath}\n`);

const range = db.prepare("SELECT MIN(month) AS first, MAX(month) AS last FROM resale").get();
console.log("Month range:", range);

const show = (label: string, sql: string) => {
  console.log(`\n${label}:`);
  console.log(db.prepare(sql).all().map((r: any) => Object.values(r).join("  |  ")).join("\n"));
};

show("Flat types (with counts)", "SELECT flat_type, COUNT(*) FROM resale GROUP BY flat_type ORDER BY 2 DESC");
show("Storey ranges", "SELECT DISTINCT storey_range FROM resale ORDER BY storey_range");
show("Flat models", "SELECT DISTINCT flat_model FROM resale ORDER BY flat_model");
show("Towns", "SELECT DISTINCT town FROM resale ORDER BY town");
show("Rows with missing remaining_lease", "SELECT COUNT(*) FROM resale WHERE remaining_lease IS NULL");

db.close();