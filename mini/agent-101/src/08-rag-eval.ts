/**
 * L8 · RAG 检索精度评测 + Hybrid Search 优化
 *
 * 做三件事：
 *   1) 建一个「标准答案测试集」（问题 → 期望命中的 chunk）
 *   2) 分别用 TF-IDF、Embedding、Hybrid 三种方式搜，算精度指标
 *   3) 对比三种方式的 Recall@3 和 MRR
 *
 * 你将学到：
 *   - 怎么量化"搜得准不准"（Recall@K, MRR）
 *   - Hybrid Search = TF-IDF + Embedding 混合，为什么几乎总是最优
 *   - 面试高频题："你怎么评估和优化 RAG 检索质量？"
 */
import { chunkMarkdown, type Chunk, TfIdfRetriever } from "./tools/rag.js";
import { embed, cosineDense } from "./tools/dashscope-embed.js";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../../");
const DOC_FILES = [
  resolve(PROJECT_ROOT, "docs/01-vision.md"),
  resolve(PROJECT_ROOT, "docs/02-architecture.md"),
  resolve(PROJECT_ROOT, "docs/03-learning-path.md"),
  resolve(PROJECT_ROOT, "ROADMAP.md"),
];

// ===== 1. 标准答案测试集 =====
// 每条：{ query, expectedSource, expectedHeading }
// expectedHeading 是我们认为"正确答案"所在的 chunk 标题（部分匹配即可）

const testSet = [
  { query: "Phase 2 要做什么", expected: "Phase 2 · v0.dev" },
  { query: "为什么选 Chromatic", expected: "还原度验证" },
  { query: "ROADMAP Phase 4 有几个 issue", expected: "Phase 4 · Playwright MCP" },
  { query: "项目用什么技术栈", expected: "技术栈选型" },
  { query: "ToolCard 组件在哪里生成", expected: "v0.dev" },
  { query: "MCP 协议是什么", expected: "Playwright MCP" },
  { query: "数据模型长什么样", expected: "数据模型" },
  { query: "Storybook 在项目里起什么作用", expected: "Storybook" },
  { query: "Agent loop 的核心 5 步", expected: "Phase 4" },
  { query: "目录结构是什么", expected: "目录结构" },
];

// ===== 2. 三种检索引擎 =====

// A. TF-IDF
const tfidfRetriever = new TfIdfRetriever();

// B. Embedding
let allChunks: Chunk[] = [];
let embVectors: number[][] = [];

// C. Hybrid = α × embedding + (1-α) × tfidf
const ALPHA = 0.7; // embedding 权重

async function buildAll() {
  for (const fp of DOC_FILES) allChunks.push(...chunkMarkdown(fp));
  console.log(`📚 ${allChunks.length} chunks\n`);

  // TF-IDF 索引
  tfidfRetriever.indexChunks(allChunks);

  // Embedding 索引
  console.log("⏳ Embedding 向量化中...");
  const texts = allChunks.map((c) => `${c.heading}\n${c.text}`.slice(0, 2000));
  embVectors = await embed(texts);
  console.log("✅ 向量化完成\n");
}

type SearchFn = (query: string, topK: number) => Promise<Array<Chunk & { score: number }>>;

const searchTfidf: SearchFn = async (query, topK) => {
  return tfidfRetriever.search(query, topK);
};

const searchEmbed: SearchFn = async (query, topK) => {
  const [qVec] = await embed([query]);
  return allChunks
    .map((c, i) => ({ ...c, score: cosineDense(qVec!, embVectors[i]!) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

const searchHybrid: SearchFn = async (query, topK) => {
  const tfidfHits = tfidfRetriever.search(query, allChunks.length);
  const [qVec] = await embed([query]);
  const embScores = allChunks.map((_, i) => cosineDense(qVec!, embVectors[i]!));

  // 归一化到 [0,1]
  const maxTfidf = Math.max(...tfidfHits.map((h) => h.score), 0.001);
  const maxEmb = Math.max(...embScores, 0.001);

  const tfidfMap = new Map(tfidfHits.map((h) => [h.id, h.score / maxTfidf]));

  return allChunks
    .map((c, i) => ({
      ...c,
      score: ALPHA * (embScores[i]! / maxEmb) + (1 - ALPHA) * (tfidfMap.get(c.id) ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

// ===== 3. 评测指标 =====

async function evaluate(name: string, searchFn: SearchFn, topK = 3) {
  let hits = 0;
  let reciprocalRankSum = 0;
  const details: string[] = [];

  for (const t of testSet) {
    const results = await searchFn(t.query, topK);
    const pos = results.findIndex((r) =>
      r.heading.includes(t.expected) || t.expected.includes(r.heading.slice(0, 10)),
    );
    if (pos >= 0) {
      hits++;
      reciprocalRankSum += 1 / (pos + 1);
      details.push(`  ✅ "${t.query}" → 第${pos + 1}位命中`);
    } else {
      details.push(`  ❌ "${t.query}" → 未命中 (top1: [${results[0]?.source}] ${results[0]?.heading})`);
    }
  }

  const recall = hits / testSet.length;
  const mrr = reciprocalRankSum / testSet.length;
  console.log(`\n═══ ${name} ═══`);
  console.log(`  Recall@${topK}: ${(recall * 100).toFixed(1)}% (${hits}/${testSet.length})`);
  console.log(`  MRR:     ${mrr.toFixed(3)}`);
  for (const d of details) console.log(d);
  return { name, recall, mrr, hits };
}

// ===== 4. 跑评测 =====

async function main() {
  await buildAll();

  console.log(`📋 测试集: ${testSet.length} 条\n`);
  console.log("指标解读:");
  console.log("  Recall@3 = 前 3 条结果里包含正确答案的比例（越高越好，100% = 完美）");
  console.log("  MRR = 正确答案排在第几位的倒数平均值（1.0 = 每次都排第 1）");

  const a = await evaluate("TF-IDF", searchTfidf);
  const b = await evaluate("Embedding", searchEmbed);
  const c = await evaluate("Hybrid (α=0.7)", searchHybrid);

  console.log("\n\n═══ 最终对比 ═══");
  console.table([a, b, c].map((x) => ({ 方案: x.name, "Recall@3": `${(x.recall*100).toFixed(0)}%`, MRR: x.mrr.toFixed(3), 命中数: `${x.hits}/${testSet.length}` })));
}

main().catch((e) => { console.error(e); process.exit(1); });
