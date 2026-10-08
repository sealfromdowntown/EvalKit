import { describe, it, expect } from "vitest";
import { mulberry32, shuffle } from "./rng";
import { splitFor } from "./split";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("differs across seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it("returns values in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  it("keeps all elements and does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, mulberry32(3));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("is repeatable with the same seed", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(input, mulberry32(9))).toEqual(shuffle(input, mulberry32(9)));
  });
});

describe("splitFor", () => {
  it("is stable for the same id", () => {
    expect(splitFor("gen-count-bedok-2022")).toBe(splitFor("gen-count-bedok-2022"));
  });

  it("assigns roughly 20% of ids to test", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `case-${i}`);
    const tests = ids.filter((id) => splitFor(id) === "test").length;
    expect(tests).toBeGreaterThan(150);
    expect(tests).toBeLessThan(250);
  });
});