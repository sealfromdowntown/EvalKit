export interface CompletionRequest {
  model: string;
  system: string;
  user: string;
  maxCompletionTokens: number;
  temperature?: number;
}

export interface CompletionResponse {
  text: string;
  finishReason: string | null;
  latencyMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  reasoningTokens: number | null;
}

export interface ModelClient {
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}