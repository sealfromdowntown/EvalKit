import { describe, it, expect } from "vitest";
import { extractSql } from "./extract";

describe("extractSql", () => {
  it("returns plain SQL unchanged", () => {
    expect(extractSql("SELECT 1")).toBe("SELECT 1");
  });

  it("strips a ```sql fence", () => {
    expect(extractSql("```sql\nSELECT COUNT(*) FROM resale;\n```")).toBe("SELECT COUNT(*) FROM resale;");
  });

  it("strips a bare fence and surrounding chatter", () => {
    expect(extractSql("Here you go:\n```\nSELECT 1\n```\nHope that helps!")).toBe("SELECT 1");
  });

  it("handles an unclosed fence", () => {
    expect(extractSql("```sql\nSELECT 1")).toBe("SELECT 1");
  });
});