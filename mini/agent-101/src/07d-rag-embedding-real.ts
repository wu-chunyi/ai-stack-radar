/**
 * L7d · RAG with Real Embedding（阿里百炼 text-embedding-v3）
 *
 * 终于用上真正的 Embedding 了！对比 L7a~L7c：
 *   L7a 纯 TF-IDF → Q3 搜不到（关键词不重叠）
 *   L7b Query Expansion → Q3 第 6 轮搜到（用 LLM 补关键词）
 *   L7c LLM-Augmented Index → Q3 第 7 轮搜到（离线加标签）
 *   L7d 真 Embedding → Q3 第一次搜就应该命中（语义理解）
 *
 * 整个流程跟 L7a 只有一处不同：
 *   L7a: chunk.text → tokenize → tf*idf → 稀疏向量 → 余弦
 *   L7d: chunk.text → 调 API  →         → 稠密向量 → 余弦
 *                      ↑↑↑ 只换这一步 ↑↑↑
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { chunkMarkdown, type Chunk } from "./tools/rag.js";
import { embed, cosineDense } from "./tools/dashscope-embed.js";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../../");
const DOC_FILES = [
  resolve(PROJECT_ROOT, "docs/01-vision.md"),
  resolve(PROJECT_ROOT, "docs/02-architecture.md"),
  resolve(PROJECT_ROOT, "docs/03-learning-path.md"),
  resolve(PROJECT_ROOT, "ROADMAP.md"),
];

// ===== 1. 离线：切块 → Embedding → 存向量 =====

class EmbeddingRetriever {
  private chunks: Chunk[] = [];
  private vectors: number[][] = [];

  async index(filePaths: string[]) {
    for (const fp of filePaths) this.chunks.push(...chunkMarkdown(fp));
    console.log(`📚 ${this.chunks.length} chunks，正在向量化...`);
    // 把每个 chunk 的标题 + 内容拼起来作为 embedding 输入
    const texts = this.chunks.map((c) => `${c.heading}\n${c.text}`.slice(0, 2000));
    this.vectors = await embed(texts);
    console.log(`✅ 向量化完成（${this.vectors[0]?.length} 维）\n`);
  }

  async search(query: string, topK = 5) {
    const [qVec] = await embed([query]);
    return this.chunks
      .map((chunk, i) => ({ ...chunk, score: cosineDense(qVec!, this.vectors[i]!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

// ===== 2. 在线：agent loop =====

const searchSchema = {
  type: "function" as const,
  function: {
    name: "search_docs",
    description: "在项目文档库中语义检索最相关的段落。",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "搜索问题" } },
      required: ["query"],
    },
  },
};

async function main() {
  const retriever = new EmbeddingRetriever();
  await retriever.index(DOC_FILES);

  // 跑同样的 3 个问题
  const questions = [
    "Phase 2 要做什么？需要产出哪些组件？",
    "为什么选 Chromatic 而不选 Applitools？",
    "ROADMAP 里 Phase 4 一共有几个 issue？分别是什么？",
  ];

  for (const question of questions) {
    console.log("═══════════════════════════════════════");
    console.log(`❓ ${question}\n`);

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "你是 AI Stack Radar 知识助手。必须用 search_docs 检索后再回答，标注来源。" },
      { role: "user", content: question },
    ];

    for (let turn = 1; turn <= 10; turn++) {
      console.log(`── 轮 ${turn} ──`);
      const res = await llm.chat.completions.create({ model: MODEL, messages, tools: [searchSchema] });
      const msg = res.choices[0]!.message;
      messages.push(msg);

      if (!msg.tool_calls?.length) {
        console.log("\n🎯 回答：");
        console.log(msg.content?.slice(0, 500) + (msg.content && msg.content.length > 500 ? "..." : ""));
        break;
      }

      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        const { query } = JSON.parse(tc.function.arguments) as { query: string };
        console.log(`  🔍 "${query}"`);
        const hits = await retriever.search(query, 3);
        for (const h of hits) {
          console.log(`  📄 [${h.source}] ${h.heading} (${Math.round(h.score * 1000) / 1000})`);
        }
        const payload = hits.map((h) => ({
          source: h.source, heading: h.heading,
          score: Math.round(h.score * 1000) / 1000,
          text: h.text.slice(0, 500),
        }));
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(payload) });
      }
    }
    console.log("═══════════════════════════════════════\n");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
