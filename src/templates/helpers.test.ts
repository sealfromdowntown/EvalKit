import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { displayFlatType, displayTown } from "./names";
import { medianSql, sqlString } from "./sql";

describe("displayTown", () => {
  it("title-cases towns", () => {
    expect(displayTown("TAMPINES")).toBe("Tampines");
    expect(displayTown("ANG MO KIO")).toBe("Ang Mo Kio");
    expect(displayTown("CENTRAL AREA")).toBe("Central Area");
  });

  it("handles the slash in Kallang/Whampoa", () => {
    expect(displayTown("KALLANG/WHAMPOA")).toBe("Kallang/Whampoa");
  });
});

describe("displayFlatType", () => {
  it("formats flat types", () => {
    expect(displayFlatType("4 ROOM")).toBe("4-room");
    expect(displayFlatType("EXECUTIVE")).toBe("executive");
  });
});

describe("sqlString", () => {
  it("quotes and escapes", () => {
    expect(sqlString("TAMPINES")).toBe("'TAMPINES'");
    expect(sqlString("O'Brien")).toBe("'O''Brien'");
  });
});

describe("medianSql", () => {
  const median = (values: number[], where = "town = 'A'"): unknown => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE resale (resale_price INTEGER, town TEXT)");
    const ins = db.prepare("INSERT INTO resale VALUES (?, ?)");
    for (const v of values) ins.run(v, "A");
    ins.run(999999, "B"); // an outlier the where clause must exclude
    const result = db.prepare(medianSql(where)).pluck().get();
    db.close();
    return result;
  };

  it("returns the middle value for an odd count", () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it("averages the two middle values for an even count", () => {
    expect(median([40, 10, 30, 20])).toBe(25);
  });

  it("handles a single row", () => {
    expect(median([7])).toBe(7);
  });

  it("respects the where clause", () => {
    expect(median([10, 20, 30], "town = 'A'")).toBe(20);
  });
});