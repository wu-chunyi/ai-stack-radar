/**
 * 阿里百炼 Embedding 工具
 *
 * 用 OpenAI 兼容接口调用阿里百炼的 text-embedding-v3（1024 维）
 * 跟 TF-IDF 的区别：
 *   TF-IDF：数词频 → 稀疏向量（几千维，大部分 0）
 *   Embedding：神经网络编码 → 稠密向量（固定 1024 维，每维都有值）
 */
import OpenAI from "openai";
import "dotenv/config";

if (!process.env.DASHSCOPE_API_KEY) {
  console.error("❌ 缺少 DASHSCOPE_API_KEY。去 https://bailian.console.aliyun.com 注册。");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const MODEL = "text-embedding-v3";

/** 批量向量化（每批最多 10 条，百炼 API 限制） */
export async function embed(texts: string[]): Promise<number[][]> {
  const batchSize = 10;
  const allVecs: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await client.embeddings.create({ model: MODEL, input: batch });
    for (const d of res.data) allVecs.push(d.embedding);
  }
  return allVecs;
}

/** 余弦相似度（稠密向量版） */
export function cosineDense(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
