/**
 * L11 · 向量数据库 Demo
 *
 * 演示 4 件事（每件都有计时对比）：
 *   ① 写入：切块 → Embedding → 持久化到 LanceDB
 *   ② 启动速度：第 2 次不用重新 embed，直接从磁盘搜
 *   ③ CRUD：增量添加新文档、删除旧文档
 *   ④ 对比：in-memory O(n) 暴力搜 vs LanceDB 索引搜
 *
 * 运行两次，看第 2 次启动时间的变化。
 */
import { resolve } from "node:path";
import { chunkMarkdown } from "./tools/rag.js";
import { embed, cosineDense } from "./tools/dashscope-embed.js";
import {
  createOrReplace,
  vectorSearch,
  tableExists,
  countRecords,
  addRecords,
  deleteRecords,
  listSources,
  type VectorRecord,
} from "./tools/vector-db.js";

const ROOT = resolve(import.meta.dirname, "../../../");
const REAL_FILES = [
  resolve(ROOT, "docs/01-vision.md"),
  resolve(ROOT, "docs/02-architecture.md"),
  resolve(ROOT, "docs/03-learning-path.md"),
  resolve(ROOT, "ROADMAP.md"),
];

const t = () => Date.now();

async function main() {
  console.log("══════════════════════════════════════");
  console.log("           向量数据库 Demo");
  console.log("══════════════════════════════════════\n");

  // ===== ① 首次写入 or 直接加载 =====

  const exists = await tableExists();
  let startupMs: number;

  if (!exists) {
    console.log("📦 首次运行：切块 → Embedding → 写入 LanceDB\n");
    const t0 = t();

    const chunks: ReturnType<typeof chunkMarkdown> = [];
    for (const f of REAL_FILES) chunks.push(...chunkMarkdown(f));
    console.log(`  切块：${chunks.length} 个`);

    const texts = chunks.map((c) => `${c.heading}\n${c.text}`.slice(0, 2000));
    console.log("  向量化中...");
    const vectors = await embed(texts);

    const records: VectorRecord[] = chunks.map((c, i) => ({
      id: c.id, source: c.source, heading: c.heading, text: c.text, vector: vectors[i]!,
    }));
    await createOrReplace(records);

    startupMs = t() - t0;
    console.log(`\n⏱  首次写入耗时: ${startupMs}ms（含 ${chunks.length} 次 embedding）`);
  } else {
    console.log("⚡ 数据库已存在，直接加载（不需要重新 embedding）");
    const t0 = t();
    const count = await countRecords();
    startupMs = t() - t0;
    console.log(`  记录数: ${count}  加载耗时: ${startupMs}ms`);
  }

  // ===== ② 向量搜索 =====

  const query = "为什么选 Chromatic 而不选 Applitools";
  console.log(`\n🔍 搜索: "${query}"`);

  const t1 = t();
  const [qVec] = await embed([query]);
  const results = await vectorSearch(qVec!, 3);
  const searchMs = t() - t1;

  console.log(`  耗时: ${searchMs}ms  结果:`);
  for (const r of results) {
    console.log(`  📄 [${r.source}] ${r.heading} (distance: ${r._distance.toFixed(4)})`);
  }

  // ===== ③ CRUD 演示 =====

  console.log("\n🔧 CRUD 演示");

  // 新增一条记录（模拟新文档加入）
  const newRecord: VectorRecord = {
    id: 9999,
    source: "new-tool.md",
    heading: "一个新工具",
    text: "这是新加入知识库的文档，关于 BGE-M3 的最新评测。",
    vector: (await embed(["这是新加入知识库的文档，关于 BGE-M3 的最新评测。"]))[0]!,
  };
  await addRecords([newRecord]);
  console.log(`  ✅ 增量添加 1 条，当前总数: ${await countRecords()}`);

  // 列出所有来源
  const sources = await listSources();
  console.log(`  📚 数据库中的文件来源: ${sources.join(", ")}`);

  // 验证新文档可以被搜到
  const [q2] = await embed(["BGE-M3 评测"]);
  const hit = await vectorSearch(q2!, 3);
  const found = hit.some((r) => r.source === "new-tool.md");
  console.log(`  🔍 搜索 "BGE-M3 评测" → 新文档被搜到: ${found ? "✅" : "❌"}`);

  // 删除新加的文档
  await deleteRecords("new-tool.md");
  console.log(`  🗑️  删除后总数: ${await countRecords()}`);

  // ===== ④ 性能对比 =====

  console.log("\n📊 性能对比（10 次搜索）");
  const [testVec] = await embed(["Phase 4 issue"]);

  // in-memory 暴力 O(n)
  const allCount = await countRecords();
  const { chunkMarkdown: cm } = await import("./tools/rag.js");
  const inmemChunks: ReturnType<typeof cm> = [];
  for (const f of REAL_FILES) inmemChunks.push(...cm(f));
  const inmemVecs = inmemChunks.map(() => testVec!); // 用同一个向量模拟

  const t2 = t();
  for (let i = 0; i < 10; i++) {
    inmemChunks.map((c, j) => ({ ...c, score: cosineDense(testVec!, inmemVecs[j]!) }))
      .sort((a, b) => b.score - a.score).slice(0, 3);
  }
  const inmemMs = t() - t2;

  // LanceDB 索引搜索
  const t3 = t();
  for (let i = 0; i < 10; i++) await vectorSearch(testVec!, 3);
  const lanceMs = t3 > t3 ? 0 : t() - t3;

  console.log(`  In-memory O(n) 暴力 × 10: ${inmemMs}ms`);
  console.log(`  LanceDB 索引搜索 × 10:    ${Date.now() - t3}ms`);
  console.log(`  记录总数: ${allCount}`);

  console.log("\n══════════════════════════════════════");
  console.log("💡 核心收益：");
  console.log(`  首次运行需要 embedding（慢）`);
  console.log(`  之后每次启动只需 ${startupMs < 200 ? startupMs + "ms（快！）" : "直接读磁盘，无 API 调用"}`);
  console.log("  新增/删除文档不需要重建整个索引");
  console.log("══════════════════════════════════════");
}

main().catch((e) => { console.error(e); process.exit(1); });
