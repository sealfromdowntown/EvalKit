import OpenAI from "openai";
import type { CompletionRequest, CompletionResponse, ModelClient } from "./types";

export class OpenAIClient implements ModelClient {
  private client = new OpenAI({ maxRetries: 5 }); // SDK retries 429/5xx with backoff

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();
    const res = await this.client.chat.completions.create({
      model: req.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      max_completion_tokens: req.maxCompletionTokens,
      // Only send temperature if the config sets it; some models reject it.
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    });
    const choice = res.choices[0];
    return {
      text: choice?.message?.content ?? "",
      finishReason: choice?.finish_reason ?? null,
      latencyMs: Date.now() - start,
      tokensIn: res.usage?.prompt_tokens ?? null,
      tokensOut: res.usage?.completion_tokens ?? null,
      reasoningTokens: res.usage?.completion_tokens_details?.reasoning_tokens ?? null,
    };
  }
}