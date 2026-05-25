"use client";

/**
 * AI 工具推荐组件（客户端，流式显示）
 *
 * 用 Vercel AI SDK 的 useChat hook 处理流式响应：
 *   - 自动管理 messages 状态
 *   - 自动处理 streaming protocol 解析
 *   - 实时更新 UI（逐字显示）
 *
 * 对比学习：
 *   mini/ 里我们手写了 messages.push() 和 while loop
 *   这里 useChat 帮我们做了同样的事，但加了 streaming UI 绑定
 */
import { useChat } from "@ai-sdk/react";
import { useState } from "react";

const EXAMPLE_QUERIES = [
  "本地部署、保护隐私的代码补全工具",
  "适合个人开发者的 AI 编程助手，预算有限",
  "能处理整个代码库的 AI 编辑器",
  "RAG 知识库搭建框架，中文友好",
  "Cursor 有什么开源替代品",
];

export function ToolRecommender() {
  const [inputValue, setInputValue] = useState("");

  const { messages, append, isLoading } = useChat({
    api: "/api/recommend",
  });

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;
    setInputValue("");
    await append({ role: "user", content: query });
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* 搜索框 */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
          placeholder="描述你的需求，例如「本地部署的代码补全工具」"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit(inputValue)}
          disabled={isLoading}
        />
        <button
          className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          onClick={() => handleSubmit(inputValue)}
          disabled={isLoading || !inputValue.trim()}
        >
          {isLoading ? "搜索中…" : "推荐"}
        </button>
      </div>

      {/* 示例查询 */}
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400">试试这些查询：</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
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
      {(lastUser || isLoading) && (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
          {lastUser && (
            <p className="mb-3 text-xs font-medium text-zinc-400">
              需求：{lastUser.content}
            </p>
          )}
          {lastAssistant ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
              {lastAssistant.content.split("\n").map((line, i) => (
                <p key={i} className={line.startsWith("###") ? "font-semibold" : ""}>
                  {line || "\u00A0"}
                </p>
              ))}
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
