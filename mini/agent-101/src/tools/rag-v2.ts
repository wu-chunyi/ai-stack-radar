/**
 * RAG v2 · 三层优化工具
 *
 * ❶ Chunking v2：更小的块 + 重叠 + 标题拼入正文
 * ❷ Hybrid Search：BM25(TF-IDF) + Embedding 加权融合
 * ❸ Reranking：LLM 精排 top-N
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { embed, cosineDense } from "./dashscope-embed.js";
import { TfIdfRetriever, type Chunk } from "./rag.js";
import { llm, MODEL } from "../llm.js";

// ===== ❶ Chunking v2 =====

/** 按标题切 + 长块再按字数拆 + 相邻块重叠 */
export function chunkMarkdownV2(
  filePath: string,
  maxLen = 300,
  overlap = 80,
): Chunk[] {
  const raw = readFileSync(filePath, "utf-8");
  const source = basename(filePath);
  const chunks: Chunk[] = [];
  let heading = source;
  let buffer = "";

  const flush = () => {
    if (buffer.trim().length < 20) return;
    // 标题拼进正文（关键优化：让 embedding 同时看到标题和内容）
    const fullText = `【${heading}】\n${buffer.trim()}`;
    // 如果太长，按 maxLen 拆分并加 overlap
    if (fullText.length <= maxLen) {
      chunks.push({ id: chunks.length, source, heading, text: fullText });
    } else {
      for (let start = 0; start < fullText.length; start += maxLen - overlap) {
        const slice = fullText.slice(start, start + maxLen);
        if (slice.trim().length > 20) {
          chunks.push({ id: chunks.length, source, heading, text: slice.trim() });
        }
      }
    }
  };

  for (const line of raw.split("\n")) {
    if (/^#{1,3}\s/.test(line)) {
      flush();
      heading = line.replace(/^#+\s*/, "").trim();
      buffer = "";
    } else {
      buffer += line + "\n";
    }
  }
  flush();
  return chunks;
}

// ===== ❷ Hybrid Search =====

export class HybridRetriever {
  private chunks: Chunk[] = [];
  private embVectors: number[][] = [];
  private tfidf = new TfIdfRetriever();

  async index(filePaths: string[], useV2Chunking = true) {
    for (const fp of filePaths) {
      const fn = useV2Chunking ? chunkMarkdownV2 : (await import("./rag.js")).chunkMarkdown;
      this.chunks.push(...fn(fp));
    }
    // TF-IDF 索引
    this.tfidf.indexChunks(this.chunks);
    // Embedding 索引
    const texts = this.chunks.map((c) => c.text.slice(0, 2000));
    this.embVectors = await embed(texts);
    return { totalChunks: this.chunks.length };
  }

  async search(query: string, topK = 10, alpha = 0.6) {
    // TF-IDF 分数
    const tfidfHits = this.tfidf.search(query, this.chunks.length);
    const tfidfMap = new Map(tfidfHits.map((h) => [h.id, h.score]));
    const maxT = Math.max(...tfidfHits.map((h) => h.score), 1e-6);

    // Embedding 分数
    const [qVec] = await embed([query]);
    const embScores = this.chunks.map((_, i) => cosineDense(qVec!, this.embVectors[i]!));
    const maxE = Math.max(...embScores, 1e-6);

    // 融合：alpha × emb_norm + (1-alpha) × tfidf_norm
    return this.chunks
      .map((c, i) => ({
        ...c,
        score: alpha * (embScores[i]! / maxE) + (1 - alpha) * ((tfidfMap.get(c.id) ?? 0) / maxT),
        embScore: embScores[i]!,
        tfidfScore: tfidfMap.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

// ===== ❸ LLM Reranking =====

export async function rerankWithLLM(
  query: string,
  candidates: Array<Chunk & { score: number }>,
  topK = 3,
): Promise<Array<Chunk & { score: number; rerankScore: number }>> {
  // 批量让 LLM 打分（一次调用，省 token）
  const prompt = candidates
    .map((c, i) => `[${i}] ${c.heading}: ${c.text.slice(0, 200)}`)
    .join("\n\n");

  const res = await llm.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "你是相关性打分器。给定一个搜索问题和若干候选文档，对每个文档的相关性打 0-10 分。" +
          "输出格式：每行一个数字，对应每个文档的分数。只输出数字，不解释。",
      },
      { role: "user", content: `问题：${query}\n\n候选文档：\n${prompt}` },
    ],
    temperature: 0,
    max_tokens: 100,
  });

  const scores = (res.choices[0]?.message.content ?? "")
    .split("\n")
    .map((l) => parseFloat(l.trim()))
    .filter((n) => !isNaN(n));

  return candidates
    .map((c, i) => ({ ...c, rerankScore: scores[i] ?? 0 }))
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);
}
