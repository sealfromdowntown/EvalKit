import { describe, it, expect, beforeEach } from "vitest";
import { openResultsDb } from "../db/results";
import { FakeClient } from "../llm/fake";
import { cachedComplete, computeCost } from "./call";
import type { ResolvedCandidate } from "../config/load";

const candidate: ResolvedCandidate = {
  name: "test",
  provider: "openai",
  model: "fake-model",
  promptPath: "unused",
  promptText: "You write SQL.",
  maxCompletionTokens: 500,
};

let db: ReturnType<typeof openResultsDb>;
beforeEach(() => {
  db = openResultsDb(":memory:");
});

describe("cachedComplete", () => {
  it("makes only one API call when the same question is asked twice", async () => {
    const client = new FakeClient();
    const args = { candidate, question: "How many rows?", user: "Question: How many rows?" };

    const first = await cachedComplete(db, client, args);
    const second = await cachedComplete(db, client, args);

    expect(client.calls).toBe(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.text).toBe(first.text);
  });

  it("calls again for a different question", async () => {
    const client = new FakeClient();
    await cachedComplete(db, client, { candidate, question: "q1", user: "Question: one" });
    await cachedComplete(db, client, { candidate, question: "q2", user: "Question: two" });
    expect(client.calls).toBe(2);
  });

  it("calls again when the prompt text changes", async () => {
    const client = new FakeClient();
    const args = { question: "q", user: "Question: q" };
    await cachedComplete(db, client, { ...args, candidate });
    await cachedComplete(db, client, {
      ...args,
      candidate: { ...candidate, promptText: "A different prompt." },
    });
    expect(client.calls).toBe(2);
  });

  it("calls again when parameters change", async () => {
    const client = new FakeClient();
    const args = { question: "q", user: "Question: q" };
    await cachedComplete(db, client, { ...args, candidate });
    await cachedComplete(db, client, { ...args, candidate: { ...candidate, temperature: 0 } });
    expect(client.calls).toBe(2);
  });

  it("does not cache empty replies", async () => {
    const client = new FakeClient(() => "   ");
    const args = { candidate, question: "q", user: "Question: q" };
    await expect(cachedComplete(db, client, args)).rejects.toThrow(/Empty reply/);
    await expect(cachedComplete(db, client, args)).rejects.toThrow(/Empty reply/);
    expect(client.calls).toBe(2);
  });

  it("stores cost when pricing is configured", async () => {
    const client = new FakeClient(); // 100 tokens in, 20 out
    const priced = { ...candidate, pricePer1M: { input: 1, output: 2 } };
    const r = await cachedComplete(db, client, { candidate: priced, question: "q", user: "u" });
    expect(r.costUsd).toBeCloseTo((100 * 1 + 20 * 2) / 1_000_000, 10);
  });
});

describe("computeCost", () => {
  it("returns null without pricing or token counts", () => {
    expect(computeCost(100, 20, undefined)).toBeNull();
    expect(computeCost(null, 20, { input: 1, output: 2 })).toBeNull();
  });
});