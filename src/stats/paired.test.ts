import { describe, it, expect } from "vitest";
import { mean, pairedDifferences } from "./paired";

describe("mean", () => {
  it("averages numbers", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  it("throws on an empty list", () => {
    expect(() => mean([])).toThrow();
  });
});

describe("pairedDifferences", () => {
  it("subtracts A from B case by case", () => {
    expect(pairedDifferences([1, 0, 1], [1, 1, 0])).toEqual([0, 1, -1]);
  });

  it("throws when the lists are different lengths", () => {
    expect(() => pairedDifferences([1, 0], [1])).toThrow(/mismatch/);
  });
});