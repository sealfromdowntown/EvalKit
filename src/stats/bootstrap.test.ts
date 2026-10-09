import { describe, it, expect } from "vitest";
import { bootstrapMeanDiff } from "./bootstrap";

/** Build a list of differences: `plus` wins, `minus` losses, `zero` ties. */
const mix = (plus: number, minus: number, zero: number): number[] => [
  ...new Array<number>(plus).fill(1),
  ...new Array<number>(minus).fill(-1),
  ...new Array<number>(zero).fill(0),
];

describe("bootstrapMeanDiff: exact cases", () => {
  it("gives [0, 0] when every difference is 0", () => {
    const r = bootstrapMeanDiff(mix(0, 0, 20));
    expect(r.mean).toBe(0);
    expect(r.lower).toBe(0);
    expect(r.upper).toBe(0);
  });

  it("gives [1, 1] when every difference is +1", () => {
    const r = bootstrapMeanDiff(mix(20, 0, 0));
    expect(r.lower).toBe(1);
    expect(r.upper).toBe(1);
  });

  it("reports the metadata", () => {
    const r = bootstrapMeanDiff(mix(1, 1, 8));
    expect(r.n).toBe(10);
    expect(r.resamples).toBe(10_000);
    expect(r.confidence).toBe(0.95);
  });
});

describe("bootstrapMeanDiff: repeatability", () => {
  const continuous = Array.from({ length: 30 }, (_, i) => Math.sin(i));

  it("is identical for the same seed", () => {
    expect(bootstrapMeanDiff(continuous, { seed: 1 })).toEqual(
      bootstrapMeanDiff(continuous, { seed: 1 }),
    );
  });

  it("changes slightly for a different seed", () => {
    const a = bootstrapMeanDiff(continuous, { seed: 1 });
    const b = bootstrapMeanDiff(continuous, { seed: 2 });
    expect([a.lower, a.upper]).not.toEqual([b.lower, b.upper]);
  });
});

describe("bootstrapMeanDiff: your real v1 vs v2 data", () => {
  // 7 cases v2 fixed, 3 cases v2 broke, 39 ties
  const r = bootstrapMeanDiff(mix(7, 3, 39));

  it("has the right observed mean (4/49)", () => {
    expect(r.mean).toBeCloseTo(4 / 49, 10);
  });

  it("is close to the hand estimate and includes zero", () => {
    expect(r.lower).toBeGreaterThan(-0.08);
    expect(r.lower).toBeLessThan(-0.01);
    expect(r.upper).toBeGreaterThan(0.17);
    expect(r.upper).toBeLessThan(0.24);
  });
});

describe("bootstrapMeanDiff: it behaves like a real statistic", () => {
  it("gets narrower with more data at the same proportions", () => {
    const small = bootstrapMeanDiff([1, 1, -1, 0, 0, 0, 0, 0, 0, 0]);
    const big = bootstrapMeanDiff(
      Array.from({ length: 100 }, (_, i) => [1, 1, -1, 0, 0, 0, 0, 0, 0, 0][i % 10]),
    );
    expect(small.upper - small.lower).toBeGreaterThan(big.upper - big.lower);
  });

  it("detects a real effect (30 wins, 10 losses, 60 ties)", () => {
    const r = bootstrapMeanDiff(mix(30, 10, 60));
    expect(r.lower).toBeGreaterThan(0);
  });

  it("does not invent an effect (20 wins, 20 losses, 60 ties)", () => {
    const r = bootstrapMeanDiff(mix(20, 20, 60));
    expect(r.lower).toBeLessThan(0);
    expect(r.upper).toBeGreaterThan(0);
  });
});

describe("bootstrapMeanDiff: bad input", () => {
  it("rejects an empty list", () => {
    expect(() => bootstrapMeanDiff([])).toThrow();
  });

  it("rejects a confidence of 0 or 1", () => {
    expect(() => bootstrapMeanDiff([1], { confidence: 0 })).toThrow();
    expect(() => bootstrapMeanDiff([1], { confidence: 1 })).toThrow();
  });

  it("rejects too few resamples", () => {
    expect(() => bootstrapMeanDiff([1], { resamples: 10 })).toThrow();
  });
});