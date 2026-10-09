import { mulberry32 } from "../templates/rng";
import { mean } from "./paired";

export interface BootstrapOptions {
  /** How many fake test sets to simulate. */
  resamples?: number; // default 10,000
  /** 0.95 means a 95% interval. */
  confidence?: number; // default 0.95
  /** Fixes the random numbers so results are repeatable. */
  seed?: number; // default 12345
}

export interface BootstrapResult {
  n: number; // number of cases
  mean: number; // observed average difference
  lower: number; // bottom of the interval
  upper: number; // top of the interval
  confidence: number;
  resamples: number;
}

export function bootstrapMeanDiff(
  diffs: number[],
  opts: BootstrapOptions = {},
): BootstrapResult {
  const { resamples = 10_000, confidence = 0.95, seed = 12345 } = opts;

  if (diffs.length === 0) {
    throw new Error("bootstrapMeanDiff: need at least one case");
  }
  if (!(confidence > 0 && confidence < 1)) {
    throw new Error("bootstrapMeanDiff: confidence must be between 0 and 1");
  }
  if (!Number.isInteger(resamples) || resamples < 100) {
    throw new Error("bootstrapMeanDiff: resamples must be an integer of at least 100");
  }

  const n = diffs.length;
  
  const rand = mulberry32(seed);
  const means = new Array<number>(resamples);

  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      // Pick a random case, with replacement.
      sum += diffs[Math.floor(rand() * n)];
    }
    means[r] = sum / n;
  }

    means.sort((x, y) => x - y);

  const alpha = 1 - confidence; // 0.05 for a 95% interval
  const lowerIdx = Math.floor((alpha / 2) * resamples);
  const upperIdx = Math.min(
    resamples - 1,
    Math.ceil((1 - alpha / 2) * resamples) - 1,
  );

  return {
    n,
    mean: mean(diffs),
    lower: means[lowerIdx],
    upper: means[upperIdx],
    confidence,
    resamples,
  };
}