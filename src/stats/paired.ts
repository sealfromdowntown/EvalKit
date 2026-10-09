/** Average of a non-empty list of numbers. */
export function mean(xs: number[]): number {
  if (xs.length === 0) throw new Error("mean: need at least one value");
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

/**
 * Per-case differences, candidate B minus candidate A.
 * `a` and `b` must list the cases in the same order.
 * Positive means B did better on that case.
 */
export function pairedDifferences(a: number[], b: number[]): number[] {
  if (a.length !== b.length) {
    throw new Error(`pairedDifferences: length mismatch (${a.length} vs ${b.length})`);
  }
  return b.map((value, i) => value - a[i]);
}