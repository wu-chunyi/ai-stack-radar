import OpenAI from "openai";
import "dotenv/config";

if (!process.env.DEEPSEEK_API_KEY) {
  console.error("❌ 缺少 DEEPSEEK_API_KEY。请 cp .env.example .env 后填入 key。");
  process.exit(1);
}

// DeepSeek 提供 OpenAI 兼容的 API，所以可以直接用 openai SDK
export const llm = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1",
});

export const MODEL = "deepseek-chat";
