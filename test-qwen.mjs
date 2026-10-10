
import "dotenv/config";
import { InferenceClient } from "@huggingface/inference";

const token = process.env.HF_TOKEN;

if (!token) {
  throw new Error("HF_TOKEN is missing. Check your .env file.");
}

const client = new InferenceClient(token);

const response = await client.chatCompletion({
  model: "Qwen/Qwen2.5-72B-Instruct",
  messages: [
    {
      role: "user",
      content: "Reply with exactly: Qwen connection successful",
    },
  ],
  max_tokens: 30,
});

console.log(response.choices[0].message.content);
