"use client";

/**
 * AI 工具推荐组件（客户端，流式显示）
 *
 * 用原生 fetch + ReadableStream 读取流式响应——跟你在 mini/ 里学的原理完全一样：
 *   fetch → res.body.getReader() → 循环 reader.read() → 逐块追加文字
 *
 * 为什么不用 useChat？
 *   useChat 要求 API 返回 Vercel AI SDK 私有协议格式（0:"text"\ne:{...}\nd:{...}）
 *   我们的 API 返回的是 text/plain，直接读更简单，原理也更清楚
 */
import { useState } from "react";

const EXAMPLES = [
  "本地部署、保护隐私的代码补全工具",
  "适合个人开发者的 AI 编程助手，预算有限",
  "能处理整个代码库的 AI 编辑器",
  "RAG 知识库搭建框架，中文友好",
  "Cursor 有什么开源替代品",
];

export function ToolRecommender() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;
    setInput("");
    setUserQuery(query);
    setResult("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok || !res.body) throw new Error(`${res.status}`);

      // 核心：用 ReadableStream reader 逐块读取流式输出
      // 跟 mini/agent-101 里手写的 while loop 逻辑完全相同
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResult((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setResult(`出错了：${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* 搜索框 */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
          placeholder="描述你的需求，例如「本地部署的代码补全工具」"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit(input)}
          disabled={isLoading}
        />
        <button
          className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          onClick={() => handleSubmit(input)}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? "搜索中…" : "推荐"}
        </button>
      </div>

      {/* 示例查询 */}
      {!userQuery && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400">试试这些查询：</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((q) => (
              <button
                key={q}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400"
                onClick={() => handleSubmit(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 结果展示 */}
      {(userQuery || isLoading) && (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
          {userQuery && (
            <p className="mb-3 text-xs font-medium text-zinc-400">需求：{userQuery}</p>
          )}
          {result ? (
            <div className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
              {result}
              {isLoading && <span className="animate-pulse">▍</span>}
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="animate-pulse">●</span>
              <span>正在搜索工具库并生成推荐…</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
