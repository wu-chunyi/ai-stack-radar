/**
 * Embedding 工具：两种方案
 *
 * 方案 A · Query Expansion（用 DeepSeek chat）：
 *   让 LLM 把用户问题扩展成多种同义表述 → 用原来的 TF-IDF 搜每个表述 → 合并去重
 *   本质是用 LLM 做「同义词扩展」，弥补 TF-IDF 的关键词不重叠问题
 *   优点：不需要新 API key，不需要新依赖
 *   面试考点：Query Expansion / Query Rewriting 是 RAG 优化的标准技术
 *
 * 方案 B · 真 Embedding（用 Jina AI）：
 *   调 Jina Embedding API 把文本变成 1024 维稠密向量 → 余弦相似度
 *   需要 JINA_API_KEY（免费注册送 10M token：https://jina.ai/?sui=apikey）
 */
import { llm, MODEL } from "../llm.js";

// ===== 方案 A: Query Expansion =====

export async function expandQuery(query: string): Promise<string[]> {
  const res = await llm.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "你是查询扩展器。给定一个用户问题，输出 5 个语义相同但用词不同的搜索查询。" +
          "每行一个，不要编号，不要解释，只输出查询文本。" +
          "务必包含原问题中可能的同义词、近义表述、相关术语。",
      },
      { role: "user", content: query },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });
  const expanded = (res.choices[0]?.message.content ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3);
  return [query, ...expanded]; // 原始 query + 扩展的
}

// ===== 方案 B: Jina Embedding =====

const JINA_API_KEY = process.env.JINA_API_KEY;
const JINA_MODEL = "jina-embeddings-v3";

export async function jinaEmbed(texts: string[]): Promise<number[][]> {
  if (!JINA_API_KEY) {
    throw new Error(
      "需要 JINA_API_KEY。免费注册：https://jina.ai/?sui=apikey\n" +
        "拿到 key 后写入 .env：JINA_API_KEY=jina_xxxx",
    );
  }
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      input: texts,
      normalized: true,
    }),
  });
  if (!res.ok) throw new Error(`Jina API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

/** 余弦相似度（稠密向量版，数组 vs 数组） */
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
