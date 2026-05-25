/**
 * L7b · RAG Agent（Embedding 增强版）
 *
 * 对比 L7a（纯 TF-IDF），本版用 Query Expansion 解决"关键词不重叠搜不到"的问题。
 *
 * 流程：
 *   1) 用户提问
 *   2) LLM 把问题扩展成 5 种不同表述（Query Expansion）
 *   3) 每种表述分别用 TF-IDF 搜索
 *   4) 合并去重，取 top-5
 *   5) 塞进 prompt 给 LLM 回答
 *
 * 重点对比：L7a 第 3 题搜不到的问题，这里能不能搜到？
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { TfIdfRetriever, type Chunk } from "./tools/rag.js";
import { expandQuery } from "./tools/embedding.js";
import { resolve } from "node:path";

// ===== 1. 索引（跟 L7a 完全一样）=====

const PROJECT_ROOT = resolve(import.meta.dirname, "../../../");
const DOC_FILES = [
  resolve(PROJECT_ROOT, "docs/01-vision.md"),
  resolve(PROJECT_ROOT, "docs/02-architecture.md"),
  resolve(PROJECT_ROOT, "docs/03-learning-path.md"),
  resolve(PROJECT_ROOT, "ROADMAP.md"),
];

const retriever = new TfIdfRetriever();
retriever.index(DOC_FILES);
console.log("📚 索引完成\n");

// ===== 2. 增强检索：Query Expansion + TF-IDF =====

async function enhancedSearch(query: string, topK = 5) {
  console.log(`  🔄 扩展查询...`);
  const expanded = await expandQuery(query);
  console.log(`  📝 扩展结果（${expanded.length} 条）:`);
  for (const q of expanded) console.log(`     "${q}"`);

  // 每个扩展 query 都搜一遍，合并去重
  const seen = new Set<number>();
  const allResults: Array<Chunk & { score: number; matchedBy: string }> = [];

  for (const q of expanded) {
    const hits = retriever.search(q, 3);
    for (const hit of hits) {
      if (!seen.has(hit.id)) {
        seen.add(hit.id);
        allResults.push({ ...hit, matchedBy: q });
      }
    }
  }

  // 按 score 排序取 top-K
  return allResults.sort((a, b) => b.score - a.score).slice(0, topK);
}

// ===== 3. Agent Loop =====

const searchDocsSchema = {
  type: "function" as const,
  function: {
    name: "search_docs",
    description:
      "在项目文档库中检索最相关的段落（自动扩展查询词以提升召回率）。" +
      "返回 top-5 结果，带来源文件和相关度评分。每次回答前必须先搜索。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索问题" },
      },
      required: ["query"],
    },
  },
};

const MAX_TURNS = 10;

async function runRagAgent(question: string): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "你是 AI Stack Radar 项目的知识助手。" +
        "必须用 search_docs 工具检索后再回答，禁止编造。标注信息来源。",
    },
    { role: "user", content: question },
  ];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    console.log(`\n──── 轮 ${turn} ────`);
    const res = await llm.chat.completions.create({
      model: MODEL,
      messages,
      tools: [searchDocsSchema],
    });
    const msg = res.choices[0]!.message;
    messages.push(msg);

    if (!msg.tool_calls?.length) return msg.content ?? "(空)";

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const { query } = JSON.parse(tc.function.arguments) as { query: string };
      console.log(`  🔍 search_docs("${query}")`);

      const results = await enhancedSearch(query);
      console.log(`  📄 最终命中 ${results.length} 条:`);
      for (const r of results) {
        console.log(`     [${r.source}] ${r.heading} (score:${r.score}, via:"${r.matchedBy.slice(0, 30)}")`);
      }

      const payload = results.map((r) => ({
        source: r.source,
        heading: r.heading,
        score: r.score,
        text: r.text.slice(0, 500),
      }));
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(payload) });
    }
  }
  throw new Error(`超过 ${MAX_TURNS} 轮`);
}

// ===== 4. 跑同样的 3 个问题，对比 L7a =====

const questions = [
  "Phase 2 要做什么？需要产出哪些组件？",
  "为什么选 Chromatic 而不选 Applitools？",
  "ROADMAP 里 Phase 4 一共有几个 issue？分别是什么？", // ← L7a 搜不到的那个
];

async function main() {
  for (const q of questions) {
    console.log("\n═══════════════════════════════════════");
    console.log(`❓ ${q}`);
    const answer = await runRagAgent(q);
    console.log("\n🎯 回答：");
    console.log(answer);
    console.log("═══════════════════════════════════════");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
