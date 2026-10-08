import OpenAI from "openai";

const client = new OpenAI(); // reads OPENAI_API_KEY from the environment

const res = await client.chat.completions.create({
  model: "gpt-6-luna", // keep the model you already used
  messages: [{ role: "user", content: "Reply with the single word: ready" }],
  max_completion_tokens: 200,
});

console.log("reply:", JSON.stringify(res.choices[0].message.content));
console.log("finish_reason:", res.choices[0].finish_reason);
console.log("usage:", res.usage);