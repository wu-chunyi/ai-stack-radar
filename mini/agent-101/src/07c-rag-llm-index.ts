/**
 * L7c · RAG with LLM-Augmented Indexing
 *
 * 离线：让 LLM 给每个 chunk 生成搜索标签 → 拼进文本 → TF-IDF 索引
 * 在线：普通 TF-IDF 搜索（零额外 LLM 成本）
 *
 * 对比：L7a 纯 TF-IDF(Q3❌) / L7b 在线扩展(Q3✅但每次多调LLM) / L7c 离线增强(Q3?)
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { chunkMarkdown, type Chunk, TfIdfRetriever } from "./tools/rag.js";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../../");
const DOC_FILES = [
  resolve(PROJECT_ROOT, "docs/01-vision.md"),
  resolve(PROJECT_ROOT, "docs/02-architecture.md"),
  resolve(PROJECT_ROOT, "docs/03-learning-path.md"),
  resolve(PROJECT_ROOT, "ROADMAP.md"),
];

async function generateTags(chunk: Chunk): Promise<string> {
  const res = await llm.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "给定一段项目文档，输出10个用户可能用来搜索这段内容的关键词。" +
          "每行一个，不编号，包含同义词、英中对照。",
      },
      { role: "user", content: `[${chunk.source}/${chunk.heading}]\n${chunk.text.slice(0, 600)}` },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });
  return res.choices[0]?.message.content ?? "";
}

async function buildIndex() {
  const allChunks: Chunk[] = [];
  for (const fp of DOC_FILES) allChunks.push(...chunkMarkdown(fp));
  console.log(`📚 ${allChunks.length} chunks`);
  console.log(`🏷️  生成标签中...`);
  const augTexts: string[] = [];
  for (let i = 0; i < allChunks.length; i++) {
    const tags = await generateTags(allChunks[i]!);
    augTexts.push(allChunks[i]!.text + "\n[tags] " + tags);
    process.stdout.write(`  ${i + 1}/${allChunks.length}\r`);
  }
  console.log(`\n✅ done\n`);
  const r = new TfIdfRetriever();
  r.indexChunks(allChunks, augTexts);
  return r;
}

const searchSchema = {
  type: "function" as const,
  function: {
    name: "search_docs",
    description: "在项目文档库中检索最相关段落（已增强索引）。",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "搜索问题" } },
      required: ["query"],
    },
  },
};

async function main() {
  const retriever = await buildIndex();
  const q = "ROADMAP 里 Phase 4 一共有几个 issue？分别是什么？";
  console.log(`═══ ❓ ${q} ═══\n`);

  console.log("── 直接搜索 ──");
  for (const h of retriever.search(q, 5))
    console.log(`  [${h.source}] ${h.heading} (${Math.round(h.score*1000)/1000})`);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: "你是知识助手。必须用 search_docs 检索后再回答，标注来源。" },
    { role: "user", content: q },
  ];
  for (let t = 1; t <= 10; t++) {
    console.log(`\n── 轮 ${t} ──`);
    const res = await llm.chat.completions.create({ model: MODEL, messages, tools: [searchSchema] });
    const msg = res.choices[0]!.message;
    messages.push(msg);
    if (!msg.tool_calls?.length) { console.log("\n🎯\n" + msg.content); break; }
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const { query } = JSON.parse(tc.function.arguments) as { query: string };
      console.log(`  🔍 "${query}"`);
      const hits = retriever.search(query, 5);
      for (const h of hits) console.log(`    [${h.source}] ${h.heading} (${Math.round(h.score*1000)/1000})`);
      messages.push({
        role: "tool", tool_call_id: tc.id,
        content: JSON.stringify(hits.map(h => ({ source:h.source, heading:h.heading, score:h.score, text:h.text.slice(0,500) }))),
      });
    }
  }
  console.log("═══════════════════════════════════════");
}
main().catch((e) => { console.error(e); process.exit(1); });
