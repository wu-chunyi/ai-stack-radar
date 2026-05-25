/**
 * AI 工具推荐 API Route（流式）
 *
 * POST /api/recommend
 * Body: { query: string }
 *
 * 流程：
 *   1. 关键词搜索工具库（RAG 检索）
 *   2. 把检索到的工具文档拼成 context
 *   3. 调 DeepSeek，以流式方式返回推荐
 *
 * 用 Vercel AI SDK 的 streamText：
 *   - 跟我们在 mini/ 里手写的 while loop 一个道理
 *   - 但框架帮我们处理了 streaming protocol、错误处理、token 计数
 *   - 对比学习：mini/agent-101/src/07d-rag-embedding-real.ts
 */
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { searchTools, buildContext } from "@/lib/tool-search";
import { NextRequest } from "next/server";

// DeepSeek 兼容 OpenAI API，直接用 createOpenAI 改 baseURL
const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
});

export async function POST(req: NextRequest) {
  const { query } = (await req.json()) as { query: string };

  if (!query?.trim()) {
    return new Response("请输入搜索内容", { status: 400 });
  }

  // ── RAG：检索相关工具文档 ──────────────────────────────────────
  const relevantTools = searchTools(query, 5);
  const context = buildContext(relevantTools);

  // ── 流式 LLM 调用 ──────────────────────────────────────────────
  const result = streamText({
    model: deepseek("deepseek-chat"),
    system:
      "你是 AI Stack Radar 的智能推荐助手。" +
      "根据用户需求和提供的工具资料，给出精准、有说服力的推荐。" +
      "格式：先给出推荐结论，再按「核心理由 / 定价 / 适合谁 / 替代方案」展开。" +
      "语言简洁有力，避免废话。如果资料不足，诚实说明。",
    messages: [
      {
        role: "user",
        content:
          `用户需求：${query}\n\n` +
          `相关工具资料：\n${context}\n\n` +
          `请根据以上资料给出推荐。`,
      },
    ],
    maxTokens: 1000,
  });

  // 返回 Vercel AI SDK 的标准流式响应
  return result.toDataStreamResponse();
}
