import { alignScores, type ScoreRow } from "./align";
import {
  bootstrapMeanDiff,
  type BootstrapOptions,
  type BootstrapResult,
} from "./bootstrap";
import { pairedDifferences } from "./paired";

export interface Comparison {
  nameA: string;
  nameB: string;
  n: number; // cases actually compared
  excluded: string[]; // dropped for API errors
  missing: string[]; // present for only one candidate
  passedA: number; // out of n
  passedB: number; // out of n
  fixed: string[]; // B passed, A failed
  broken: string[]; // A passed, B failed
  ties: number;
  interval: BootstrapResult;
  significant: boolean; // true when the interval excludes zero
}

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

/** Compare candidate B against candidate A. Positive differences favour B. */
export function compareCandidates(
  nameA: string,
  rowsA: ScoreRow[],
  nameB: string,
  rowsB: ScoreRow[],
  opts: BootstrapOptions = {},
): Comparison {
  const aligned = alignScores(rowsA, rowsB);
  const n = aligned.caseIds.length;
  if (n === 0) {
    throw new Error(`compareCandidates: no cases in common between "${nameA}" and "${nameB}"`);
  }

  const diffs = pairedDifferences(aligned.a, aligned.b);

  const fixed: string[] = [];
  const broken: string[] = [];
  diffs.forEach((d, i) => {
    if (d > 0) fixed.push(aligned.caseIds[i]);
    else if (d < 0) broken.push(aligned.caseIds[i]);
  });

  const interval = bootstrapMeanDiff(diffs, opts);

  return {
    nameA,
    nameB,
    n,
    excluded: aligned.excluded,
    missing: aligned.missing,
    passedA: sum(aligned.a),
    passedB: sum(aligned.b),
    fixed,
    broken,
    ties: n - fixed.length - broken.length,
    interval,
    significant: interval.lower > 0 || interval.upper < 0,
  };
}