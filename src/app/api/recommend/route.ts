/**
 * AI 工具推荐 API Route（流式）
 *
 * POST /api/recommend
 * Body: { query: string }
 * Response: text/plain stream（逐块输出文字）
 *
 * 直接用 OpenAI SDK 的 stream 模式，返回 ReadableStream。
 * 比 Vercel AI SDK 协议简单，前端直接 fetch + reader 读就行。
 */
import OpenAI from "openai";
import { searchTools, buildContext } from "@/lib/tool-search";
import { NextRequest } from "next/server";

const client = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
});

export async function POST(req: NextRequest) {
  const { query } = (await req.json()) as { query: string };
  if (!query?.trim()) {
    return new Response("请输入搜索内容", { status: 400 });
  }

  const relevantTools = searchTools(query, 5);
  const context = buildContext(relevantTools);

  // 创建 DeepSeek 流式请求
  const stream = await client.chat.completions.create({
    model: "deepseek-chat",
    stream: true,
    max_tokens: 1000,
    messages: [
      {
        role: "system",
        content:
          "你是 AI Stack Radar 的智能推荐助手。根据用户需求和工具资料给出推荐。" +
          "格式：推荐结论 → 核心理由 → 定价 → 适合谁 → 替代方案。简洁有力。",
      },
      {
        role: "user",
        content: `用户需求：${query}\n\n工具资料：\n${context}\n\n请给出推荐。`,
      },
    ],
  });

  // 把 OpenAI stream 转成 Web ReadableStream 直接返回给浏览器
  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
