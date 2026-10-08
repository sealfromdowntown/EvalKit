import OpenAI from "openai";

const client = new OpenAI(); // reads OPENAI_API_KEY from the environment

const res = await client.chat.completions.create({
  model: "gpt-5.4-mini", // pick a small, cheap model from OpenAI's models page
  messages: [{ role: "user", content: "Reply with the single word: ready" }],
  max_tokens: 5,
});

console.log(res.choices[0].message.content);
console.log("tokens:", res.usage);