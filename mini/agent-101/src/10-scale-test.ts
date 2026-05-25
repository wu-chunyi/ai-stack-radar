/**
 * L10 · 规模验证：语料从 28 → 100 → 300 → 500 chunks，优化效果怎么变
 *
 * 做法：
 *   1. 用 DeepSeek 批量生成 AI 工具评测文档（每个 300-500 字）
 *   2. 在不同规模下跑 4 层评测
 *   3. 验证结论：优化在大规模语料下才有效
 */
import { llm, MODEL } from "./llm.js";
import { writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { chunkMarkdown, TfIdfRetriever, type Chunk } from "./tools/rag.js";
import { chunkMarkdownV2, HybridRetriever, rerankWithLLM } from "./tools/rag-v2.js";
import { embed, cosineDense } from "./tools/dashscope-embed.js";

const DATA_DIR = resolve(import.meta.dirname, "../data/synthetic");
const ROOT = resolve(import.meta.dirname, "../../../");
const REAL_FILES = [
  resolve(ROOT, "docs/01-vision.md"),
  resolve(ROOT, "docs/02-architecture.md"),
  resolve(ROOT, "docs/03-learning-path.md"),
  resolve(ROOT, "ROADMAP.md"),
];

// ===== 1. 生成合成文档 =====

const TOOLS = [
  "Cursor","Claude Code","Bolt.new","Lovable","Devin","Windsurf","Cline",
  "Replit Agent","GitHub Copilot","Amazon Q","Tabnine","Codeium","Continue",
  "Sweep AI","OpenHands","SWE-Agent","Aider","Codegen","AutoGen","CrewAI",
  "LangGraph","Vercel AI SDK","Mastra","Dify","Flowise","n8n AI","Coze",
  "FastGPT","RagFlow","MaxKB","AnythingLLM","Ollama","LM Studio","Jan",
  "LocalAI","vLLM","TensorRT-LLM","Triton Server","BentoML","Modal",
];

async function generateDocs() {
  mkdirSync(DATA_DIR, { recursive: true });
  const existing = readdirSync(DATA_DIR).filter((f) => f.endsWith(".md"));
  if (existing.length >= 30) {
    console.log(`📂 已有 ${existing.length} 份合成文档，跳过生成`);
    return;
  }
  console.log(`📝 生成 ${TOOLS.length} 份 AI 工具评测文档...`);
  // 每 5 个一批生成，省 LLM 调用次数
  for (let i = 0; i < TOOLS.length; i += 5) {
    const batch = TOOLS.slice(i, i + 5);
    const res = await llm.chat.completions.create({
      model: MODEL,
      messages: [{
        role: "system",
        content: "你是 AI 工具评测作者。为每个工具写一份 300-400 字的 Markdown 评测，包含：## 简介、## 核心功能（3-5 条）、## 定价（free/freemium/paid + 具体价格）、## 优点（3 条）、## 缺点（2 条）、## 适用场景。每份文档用 --- 分隔。内容要具体、有细节、有数字。",
      }, {
        role: "user",
        content: `请为以下工具写评测：${batch.join("、")}`,
      }],
      temperature: 0.8,
      max_tokens: 4000,
    });
    const docs = (res.choices[0]?.message.content ?? "").split(/^---$/m);
    for (let j = 0; j < batch.length && j < docs.length; j++) {
      const name = batch[j]!.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const content = `# ${batch[j]} 评测\n\n${docs[j]!.trim()}`;
      writeFileSync(join(DATA_DIR, `${name}.md`), content);
    }
    process.stdout.write(`  ${Math.min(i + 5, TOOLS.length)}/${TOOLS.length}\r`);
  }
  console.log(`\n✅ 生成完成`);
}

// ===== 2. 构建不同规模的语料 =====

function loadCorpus(scale: "small" | "medium" | "large"): string[] {
  const syntheticFiles = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(DATA_DIR, f));
  switch (scale) {
    case "small": return REAL_FILES; // ~28 chunks
    case "medium": return [...REAL_FILES, ...syntheticFiles.slice(0, 15)]; // ~100+ chunks
    case "large": return [...REAL_FILES, ...syntheticFiles]; // ~300+ chunks
  }
}

// ===== 3. 评测 =====

const testSet = [
  { query: "Phase 2 要做什么", expected: "Phase 2" },
  { query: "为什么选 Chromatic", expected: "还原度验证" },
  { query: "ROADMAP Phase 4 有几个 issue", expected: "Phase 4" },
  { query: "项目用什么技术栈", expected: "技术栈" },
  { query: "MCP 协议是什么", expected: "Playwright MCP" },
  { query: "数据模型长什么样", expected: "数据模型" },
  { query: "Cursor 的定价是多少", expected: "Cursor" },
  { query: "Devin 有什么缺点", expected: "Devin" },
  { query: "LangGraph 适合什么场景", expected: "LangGraph" },
  { query: "Ollama 的核心功能", expected: "Ollama" },
];

type Hit = Chunk & { score: number };

function calcMetrics(name: string, results: Map<string, Hit[]>) {
  let hits = 0, rr = 0;
  for (const t of testSet) {
    const res = results.get(t.query);
    if (!res) continue;
    const pos = res.findIndex((r) => r.heading?.includes(t.expected) || r.source?.includes(t.expected.toLowerCase()));
    if (pos >= 0) { hits++; rr += 1 / (pos + 1); }
  }
  return { name, recall: `${((hits / testSet.length) * 100).toFixed(0)}%`, mrr: (rr / testSet.length).toFixed(3), hits: `${hits}/${testSet.length}` };
}

async function evalScale(scale: "small" | "medium" | "large") {
  const files = loadCorpus(scale);
  const allChunks: Chunk[] = [];
  for (const f of files) allChunks.push(...chunkMarkdownV2(f));
  console.log(`\n\n🔬 规模: ${scale} (${files.length} files, ${allChunks.length} chunks)`);

  // Embedding
  console.log("  向量化...");
  const texts = allChunks.map((c) => c.text.slice(0, 2000));
  const vecs = await embed(texts);

  // 层0: 纯 Embedding
  const embSearch = async (q: string): Promise<Hit[]> => {
    const [qv] = await embed([q]);
    return allChunks.map((c, i) => ({ ...c, score: cosineDense(qv!, vecs[i]!) }))
      .sort((a, b) => b.score - a.score).slice(0, 3);
  };
  const r0 = new Map<string, Hit[]>();
  for (const t of testSet) r0.set(t.query, await embSearch(t.query));

  // 层2: Hybrid
  const tfidf = new TfIdfRetriever();
  tfidf.indexChunks(allChunks);
  const hybridSearch = async (q: string): Promise<Hit[]> => {
    const tHits = tfidf.search(q, allChunks.length);
    const tMap = new Map(tHits.map(h => [h.id, h.score]));
    const maxT = Math.max(...tHits.map(h => h.score), 1e-6);
    const [qv] = await embed([q]);
    const eScores = allChunks.map((_, i) => cosineDense(qv!, vecs[i]!));
    const maxE = Math.max(...eScores, 1e-6);
    return allChunks.map((c, i) => ({
      ...c, score: 0.6 * (eScores[i]! / maxE) + 0.4 * ((tMap.get(c.id) ?? 0) / maxT),
    })).sort((a, b) => b.score - a.score).slice(0, 3);
  };
  const r2 = new Map<string, Hit[]>();
  for (const t of testSet) r2.set(t.query, await hybridSearch(t.query));

  // 层3: Hybrid + Rerank
  const rerankSearch = async (q: string): Promise<Hit[]> => {
    const [qv] = await embed([q]);
    const tHits = tfidf.search(q, allChunks.length);
    const tMap = new Map(tHits.map(h => [h.id, h.score]));
    const maxT = Math.max(...tHits.map(h => h.score), 1e-6);
    const eScores = allChunks.map((_, i) => cosineDense(qv!, vecs[i]!));
    const maxE = Math.max(...eScores, 1e-6);
    const coarse = allChunks.map((c, i) => ({
      ...c, score: 0.6 * (eScores[i]! / maxE) + 0.4 * ((tMap.get(c.id) ?? 0) / maxT),
    })).sort((a, b) => b.score - a.score).slice(0, 10);
    return await rerankWithLLM(q, coarse, 3);
  };
  const r3 = new Map<string, Hit[]>();
  for (const t of testSet) r3.set(t.query, await rerankSearch(t.query));

  return {
    scale, chunks: allChunks.length,
    embedding: calcMetrics("Embedding", r0),
    hybrid: calcMetrics("Hybrid", r2),
    rerank: calcMetrics("+Rerank", r3),
  };
}

async function main() {
  await generateDocs();
  const results = [];
  for (const s of ["small", "medium", "large"] as const) {
    results.push(await evalScale(s));
  }
  console.log("\n\n══════════ 最终对比 ══════════");
  console.table(results.map(r => ({
    规模: `${r.scale}(${r.chunks}chunks)`,
    "Embedding Recall": r.embedding.recall, "Embedding MRR": r.embedding.mrr,
    "Hybrid Recall": r.hybrid.recall, "Hybrid MRR": r.hybrid.mrr,
    "+Rerank Recall": r.rerank.recall, "+Rerank MRR": r.rerank.mrr,
  })));
}
main().catch(e => { console.error(e); process.exit(1); });
