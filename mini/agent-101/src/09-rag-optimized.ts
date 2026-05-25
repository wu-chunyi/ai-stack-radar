/**
 * L9 · 逐层优化 RAG，每加一层跑一次评测
 *
 * 层 0: Embedding only（L7d 基线）
 * 层 1: + Chunking v2（更小块 + 重叠 + 标题拼入）
 * 层 2: + Hybrid Search（BM25 + Embedding 融合）
 * 层 3: + LLM Reranking（DeepSeek 精排 top-10 → top-3）
 *
 * 用同一个 10 题测试集，看 Recall@3 和 MRR 怎么变
 */
import { chunkMarkdown, type Chunk, TfIdfRetriever } from "./tools/rag.js";
import { embed, cosineDense } from "./tools/dashscope-embed.js";
import { HybridRetriever, chunkMarkdownV2, rerankWithLLM } from "./tools/rag-v2.js";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../../");
const FILES = [
  resolve(ROOT, "docs/01-vision.md"),
  resolve(ROOT, "docs/02-architecture.md"),
  resolve(ROOT, "docs/03-learning-path.md"),
  resolve(ROOT, "ROADMAP.md"),
];

const testSet = [
  { query: "Phase 2 要做什么", expected: "Phase 2" },
  { query: "为什么选 Chromatic", expected: "还原度验证" },
  { query: "ROADMAP Phase 4 有几个 issue", expected: "Phase 4" },
  { query: "项目用什么技术栈", expected: "技术栈" },
  { query: "ToolCard 组件在哪里生成", expected: "v0.dev" },
  { query: "MCP 协议是什么", expected: "Playwright MCP" },
  { query: "数据模型长什么样", expected: "数据模型" },
  { query: "Storybook 在项目里起什么作用", expected: "Storybook" },
  { query: "Agent loop 的核心 5 步", expected: "Phase 4" },
  { query: "目录结构是什么", expected: "目录结构" },
];

type Hit = Chunk & { score: number };
type SearchFn = (q: string) => Promise<Hit[]>;

function evaluate(name: string, results: Map<string, Hit[]>) {
  let hits = 0, rrSum = 0;
  const details: string[] = [];
  for (const t of testSet) {
    const res = results.get(t.query)!;
    const pos = res.findIndex((r) => r.heading.includes(t.expected));
    if (pos >= 0) {
      hits++;
      rrSum += 1 / (pos + 1);
      details.push(`  ✅ "${t.query}" → #${pos + 1}`);
    } else {
      details.push(`  ❌ "${t.query}" → miss (top1: ${res[0]?.heading?.slice(0, 30)})`);
    }
  }
  const recall = hits / testSet.length;
  const mrr = rrSum / testSet.length;
  console.log(`\n═══ ${name} ═══`);
  console.log(`  Recall@3: ${(recall * 100).toFixed(0)}%  MRR: ${mrr.toFixed(3)}  (${hits}/${testSet.length})`);
  for (const d of details) console.log(d);
  return { name, recall: `${(recall * 100).toFixed(0)}%`, mrr: mrr.toFixed(3), hits: `${hits}/${testSet.length}` };
}

async function runAll(name: string, searchFn: SearchFn) {
  const results = new Map<string, Hit[]>();
  for (const t of testSet) results.set(t.query, await searchFn(t.query));
  return evaluate(name, results);
}

async function main() {
  // ===== 层 0: Embedding only（旧 chunking）=====
  const chunksV1: Chunk[] = [];
  for (const f of FILES) chunksV1.push(...chunkMarkdown(f));
  const textsV1 = chunksV1.map((c) => `${c.heading}\n${c.text}`.slice(0, 2000));
  console.log("⏳ 层0: Embedding(旧chunking) 向量化...");
  const vecsV1 = await embed(textsV1);
  const layer0: SearchFn = async (q) => {
    const [qv] = await embed([q]);
    return chunksV1.map((c, i) => ({ ...c, score: cosineDense(qv!, vecsV1[i]!) }))
      .sort((a, b) => b.score - a.score).slice(0, 3);
  };
  const r0 = await runAll("层0: Embedding(旧chunk)", layer0);

  // ===== 层 1: Embedding + Chunking v2 =====
  const chunksV2: Chunk[] = [];
  for (const f of FILES) chunksV2.push(...chunkMarkdownV2(f));
  console.log(`\n⏳ 层1: Chunking v2 (${chunksV1.length}→${chunksV2.length} chunks) 向量化...`);
  const textsV2 = chunksV2.map((c) => c.text.slice(0, 2000));
  const vecsV2 = await embed(textsV2);
  const layer1: SearchFn = async (q) => {
    const [qv] = await embed([q]);
    return chunksV2.map((c, i) => ({ ...c, score: cosineDense(qv!, vecsV2[i]!) }))
      .sort((a, b) => b.score - a.score).slice(0, 3);
  };
  const r1 = await runAll("层1: +Chunking v2", layer1);

  // ===== 层 2: Hybrid Search =====
  console.log("\n⏳ 层2: Hybrid Search 建索引...");
  const hybrid = new HybridRetriever();
  await hybrid.index(FILES, true);
  const layer2: SearchFn = async (q) => {
    const hits = await hybrid.search(q, 3, 0.6);
    return hits;
  };
  const r2 = await runAll("层2: +Hybrid(α=0.6)", layer2);

  // ===== 层 3: + LLM Reranking =====
  console.log("\n⏳ 层3: +LLM Reranking (粗搜10→精排3)...");
  const layer3: SearchFn = async (q) => {
    const coarse = await hybrid.search(q, 10, 0.6);
    const reranked = await rerankWithLLM(q, coarse, 3);
    return reranked;
  };
  const r3 = await runAll("层3: +LLM Rerank", layer3);

  // ===== 汇总 =====
  console.log("\n\n══════════ 最终对比 ══════════");
  console.table([r0, r1, r2, r3]);
}

main().catch((e) => { console.error(e); process.exit(1); });
