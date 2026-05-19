/**
 * L7a · RAG Agent（TF-IDF 版）
 *
 * 用项目自己的 docs/ 和 ROADMAP.md 作为知识库。
 * 先切块 → 建索引 → 暴露 search_docs 工具 → agent 自动搜 → 塞进上下文 → 回答
 *
 * 你将看到：
 *   1) LLM 在没有检索时回答不了项目细节（它的训练数据里没有这个项目）
 *   2) 给了 search_docs 工具后，它先搜再答，每个结论有出处
 *   3) RAG 的 pattern = 我们之前学的 agent loop + 一个"搜索"工具，没有新魔法
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { TfIdfRetriever } from "./tools/rag.js";
import { resolve } from "node:path";

// ===== 1. 离线阶段：加载文档 → 切块 → 建索引 =====

const PROJECT_ROOT = resolve(import.meta.dirname, "../../../");
const DOC_FILES = [
  resolve(PROJECT_ROOT, "docs/01-vision.md"),
  resolve(PROJECT_ROOT, "docs/02-architecture.md"),
  resolve(PROJECT_ROOT, "docs/03-learning-path.md"),
  resolve(PROJECT_ROOT, "ROADMAP.md"),
];

const retriever = new TfIdfRetriever();
const indexResult = retriever.index(DOC_FILES);
console.log(`📚 索引完成：${indexResult.totalChunks} 个文档块\n`);

// ===== 2. 在线阶段：search_docs 工具 =====

const searchDocsSchema = {
  type: "function" as const,
  function: {
    name: "search_docs",
    description:
      "在项目文档库（vision、architecture、learning-path、ROADMAP）中检索与查询最相关的段落。" +
      "返回 top-3 结果，每条带来源文件、标题和相关度评分。每次回答用户问题前都应该先搜索。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词或问题" },
      },
      required: ["query"],
    },
  },
};

function searchDocs({ query }: { query: string }) {
  const results = retriever.search(query, 3);
  return results.map((r) => ({
    source: r.source,
    heading: r.heading,
    score: Math.round(r.score * 1000) / 1000,
    text: r.text.slice(0, 500), // 截断太长的块，省 token
  }));
}

// ===== 3. Agent Loop =====

const MAX_TURNS = 10;

async function runRagAgent(question: string): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "你是 AI Stack Radar 项目的知识助手。" +
        "你必须用 search_docs 工具检索项目文档后再回答，禁止凭记忆编造。" +
        "回答时标注信息来源（文件名 + 标题），让用户可以验证。",
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

    if (msg.content) {
      console.log(`  💭 ${msg.content.slice(0, 120)}${msg.content.length > 120 ? "..." : ""}`);
    }

    if (!msg.tool_calls?.length) {
      return msg.content ?? "(空)";
    }

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments) as { query: string };
      console.log(`  🔍 search_docs("${args.query}")`);
      const results = searchDocs(args);
      console.log(`  📄 找到 ${results.length} 条结果:`);
      for (const r of results) {
        console.log(`     [${r.source}] ${r.heading} (score: ${r.score})`);
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(results) });
    }
  }
  throw new Error(`超过 ${MAX_TURNS} 轮`);
}

// ===== 4. 连问 3 个问题，展示 RAG 效果 =====

const questions = [
  "Phase 2 要做什么？需要产出哪些组件？",
  "为什么选 Chromatic 而不选 Applitools？",
  "ROADMAP 里 Phase 4 一共有几个 issue？分别是什么？",
];

async function main() {
  for (const q of questions) {
    console.log("\n═══════════════════════════════════════");
    console.log(`❓ 问题：${q}`);

    const answer = await runRagAgent(q);

    console.log("\n🎯 回答：");
    console.log(answer);
    console.log("═══════════════════════════════════════");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
