import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

const CandidateSchema = z.strictObject({
  name: z.string().min(1),
  provider: z.literal("openai").default("openai"),
  model: z.string().min(1),
  prompt: z.string().min(1), // path relative to the config file
  params: z
    .strictObject({
      max_completion_tokens: z.number().int().positive().optional(),
      temperature: z.number().min(0).max(2).optional(),
    })
    .optional(),
  price_per_1m_tokens: z
    .strictObject({ input: z.number().nonnegative(), output: z.number().nonnegative() })
    .optional(),
});

const ConfigSchema = z.strictObject({
  candidates: z.array(CandidateSchema).min(1),
});

export interface ResolvedCandidate {
  name: string;
  provider: "openai";
  model: string;
  promptPath: string;
  promptText: string;
  maxCompletionTokens: number;
  temperature?: number;
  pricePer1M?: { input: number; output: number };
}

export function loadConfig(configPath: string): ResolvedCandidate[] {
  const raw = parse(readFileSync(configPath, "utf8"));
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid config ${configPath}:\n${z.prettifyError(parsed.error)}`);
  }

  const names = new Set<string>();
  return parsed.data.candidates.map((c) => {
    if (names.has(c.name)) throw new Error(`Duplicate candidate name: ${c.name}`);
    names.add(c.name);
    const promptPath = resolve(dirname(configPath), c.prompt);
    return {
      name: c.name,
      provider: c.provider,
      model: c.model,
      promptPath,
      promptText: readFileSync(promptPath, "utf8").trim(),
      maxCompletionTokens: c.params?.max_completion_tokens ?? 2000,
      temperature: c.params?.temperature,
      pricePer1M: c.price_per_1m_tokens,
    };
  });
}