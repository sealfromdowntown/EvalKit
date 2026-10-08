import type { CompletionRequest, CompletionResponse, ModelClient } from "./types";

export class FakeClient implements ModelClient {
  calls = 0;
  constructor(private reply: (req: CompletionRequest) => string = () => "SELECT 1") {}

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    this.calls++;
    return {
      text: this.reply(req),
      finishReason: "stop",
      latencyMs: 5,
      tokensIn: 100,
      tokensOut: 20,
      reasoningTokens: 0,
    };
  }
}