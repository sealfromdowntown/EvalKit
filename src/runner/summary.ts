import type { CaseScore } from "./run";

export interface CandidateSummary {
  candidate: string;
  total: number;
  passed: number;
  accuracy: number; // 0 to 1
  apiErrors: number;
  failures: Record<string, number>;
  avgLatencyMs: number | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null; // null if any call has no cost recorded
}

export function summarize(scores: CaseScore[]): CandidateSummary[] {
  const byCandidate = new Map<string, CaseScore[]>();
  for (const s of scores) {
    const list = byCandidate.get(s.candidate) ?? [];
    list.push(s);
    byCandidate.set(s.candidate, list);
  }

  return [...byCandidate.entries()].map(([candidate, list]) => {
    const failures: Record<string, number> = {};
    for (const s of list) if (s.failure) failures[s.failure] = (failures[s.failure] ?? 0) + 1;

    const called = list.filter((s) => s.latencyMs !== null);
    const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
    const costs = called.map((s) => s.costUsd);

    return {
      candidate,
      total: list.length,
      passed: list.filter((s) => s.passed).length,
      accuracy: list.length === 0 ? 0 : list.filter((s) => s.passed).length / list.length,
      apiErrors: failures["api_error"] ?? 0,
      failures,
      avgLatencyMs: called.length
        ? Math.round(sum(called.map((s) => s.latencyMs)) / called.length)
        : null,
      tokensIn: sum(called.map((s) => s.tokensIn)),
      tokensOut: sum(called.map((s) => s.tokensOut)),
      costUsd:
        costs.length > 0 && costs.every((c) => c !== null) ? sum(costs) : null,
    };
  });
}