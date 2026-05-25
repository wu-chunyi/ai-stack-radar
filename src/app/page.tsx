import { ToolRecommender } from "@/components/domain/ToolRecommender";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 font-sans">
      <main className="mx-auto max-w-2xl px-6 py-20">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-800">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            40 个 AI 工具，持续更新
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            AI Stack Radar
          </h1>
          <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400">
            描述你的需求，让 AI 帮你找到最合适的工具
          </p>
        </div>

        {/* AI 推荐组件 */}
        <ToolRecommender />

        {/* Footer */}
        <p className="mt-16 text-center text-xs text-zinc-300 dark:text-zinc-700">
          由 DeepSeek + RAG 驱动 · 数据来自 mini/agent-101/data/synthetic
        </p>
      </main>
    </div>
  );
}
