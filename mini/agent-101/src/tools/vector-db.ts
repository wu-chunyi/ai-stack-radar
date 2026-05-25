/**
 * 向量数据库工具层 · 基于 LanceDB
 *
 * LanceDB 是什么：
 *   - 嵌入式向量数据库（像 SQLite，不需要 Docker/独立进程）
 *   - 数据存到本地目录（.lancedb/），重启后仍然有
 *   - 支持 HNSW 索引（Hierarchical Navigable Small World）
 *     → 近似最近邻搜索，O(log n) 而不是暴力 O(n)
 *
 * 我们存的每条记录（schema）：
 *   id       - chunk 的唯一 ID
 *   source   - 来自哪个文件
 *   heading  - 所属标题
 *   text     - chunk 原文
 *   vector   - 1024 维 embedding 向量
 */
import * as lancedb from "@lancedb/lancedb";
import { resolve } from "node:path";

const DB_DIR = resolve(import.meta.dirname, "../../.lancedb");
const TABLE_NAME = "chunks";

export interface VectorRecord {
  id:      number;
  source:  string;
  heading: string;
  text:    string;
  vector:  number[];
}

// ===== 数据库连接（全局单例）=====

let _db: Awaited<ReturnType<typeof lancedb.connect>> | null = null;

async function db() {
  if (!_db) _db = await lancedb.connect(DB_DIR);
  return _db;
}

// ===== 建表 / 写入 =====

export async function createOrReplace(records: VectorRecord[]) {
  const database = await db();
  // overwrite=true → 每次重建（适合 demo）；生产环境用 add() 做增量
  await database.createTable(TABLE_NAME, records, { mode: "overwrite" });
  console.log(`✅ 写入 ${records.length} 条记录到 LanceDB`);
}

// 增量插入（不覆盖已有数据）
export async function addRecords(records: VectorRecord[]) {
  const database = await db();
  const table = await database.openTable(TABLE_NAME);
  await table.add(records);
  console.log(`✅ 增量写入 ${records.length} 条`);
}

// ===== 读取 =====

export async function tableExists(): Promise<boolean> {
  const database = await db();
  const names = await database.tableNames();
  return names.includes(TABLE_NAME);
}

export async function countRecords(): Promise<number> {
  const database = await db();
  const table = await database.openTable(TABLE_NAME);
  return await table.countRows();
}

// ===== 向量搜索 =====

export async function vectorSearch(
  queryVector: number[],
  topK = 5,
): Promise<Array<VectorRecord & { _distance: number }>> {
  const database = await db();
  const table = await database.openTable(TABLE_NAME);
  const results = await table
    .vectorSearch(queryVector)
    .limit(topK)
    .toArray();
  return results as Array<VectorRecord & { _distance: number }>;
}

// ===== 删除 =====

export async function deleteRecords(sourceFile: string) {
  const database = await db();
  const table = await database.openTable(TABLE_NAME);
  await table.delete(`source = '${sourceFile}'`);
  console.log(`🗑️  删除 source='${sourceFile}' 的所有记录`);
}

// ===== 列出所有 source =====

export async function listSources(): Promise<string[]> {
  const database = await db();
  const table = await database.openTable(TABLE_NAME);
  const rows = await table.query().select(["source"]).toArray();
  return [...new Set(rows.map((r) => String(r.source)))];
}
