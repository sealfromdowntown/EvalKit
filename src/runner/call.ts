import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type { ResolvedCandidate } from "../config/load";
import type { CompletionRequest, ModelClient } from "../llm/types";

export interface CallResult {
  cached: boolean;
  cacheKey: string;
  text: string;
  finishReason: string | null;
  latencyMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  reasoningTokens: number | null;
  costUsd: number | null;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function cacheKeyFor(provider: string, req: CompletionRequest): string {
  return sha(
    JSON.stringify({
      provider,
      model: req.model,
      system: req.system,
      user: req.user,
      max_completion_tokens: req.maxCompletionTokens,
      temperature: req.temperature ?? null,
    }),
  );
}

export function computeCost(
  tokensIn: number | null,
  tokensOut: number | null,
  price?: { input: number; output: number },
): number | null {
  if (!price || tokensIn === null || tokensOut === null) return null;
  return (tokensIn * price.input + tokensOut * price.output) / 1_000_000;
}

interface Row {
  output_text: string;
  finish_reason: string | null;
  latency_ms: number;
  tokens_in: number | null;
  tokens_out: number | null;
  reasoning_tokens: number | null;
  cost_usd: number | null;
}

export async function cachedComplete(
  db: Database.Database,
  client: ModelClient,
  args: { candidate: ResolvedCandidate; question: string; user: string },
): Promise<CallResult> {
  const { candidate, question, user } = args;
  const req: CompletionRequest = {
    model: candidate.model,
    system: candidate.promptText,
    user,
    maxCompletionTokens: candidate.maxCompletionTokens,
    temperature: candidate.temperature,
  };
  const cacheKey = cacheKeyFor(candidate.provider, req);

  const hit = db.prepare("SELECT * FROM calls WHERE cache_key = ?").get(cacheKey) as Row | undefined;
  if (hit) {
    return {
      cached: true,
      cacheKey,
      text: hit.output_text,
      finishReason: hit.finish_reason,
      latencyMs: hit.latency_ms,
      tokensIn: hit.tokens_in,
      tokensOut: hit.tokens_out,
      reasoningTokens: hit.reasoning_tokens,
      costUsd: hit.cost_usd,
    };
  }

  const res = await client.complete(req);
  if (res.text.trim() === "") {
    // Don't cache empty replies; a retry should be allowed to try again.
    throw new Error(
      `Empty reply from ${candidate.model} (finish_reason: ${res.finishReason}). ` +
        `If it is "length", raise max_completion_tokens.`,
    );
  }

  const costUsd = computeCost(res.tokensIn, res.tokensOut, candidate.pricePer1M);
  db.prepare(
    `INSERT OR REPLACE INTO calls
     (cache_key, provider, model, prompt_hash, question, output_text, finish_reason,
      latency_ms, tokens_in, tokens_out, reasoning_tokens, cost_usd, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    cacheKey, candidate.provider, candidate.model, sha(candidate.promptText), question,
    res.text, res.finishReason, res.latencyMs, res.tokensIn, res.tokensOut,
    res.reasoningTokens, costUsd, new Date().toISOString(),
  );

  return {
    cached: false,
    cacheKey,
    text: res.text,
    finishReason: res.finishReason,
    latencyMs: res.latencyMs,
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut,
    reasoningTokens: res.reasoningTokens,
    costUsd,
  };
}