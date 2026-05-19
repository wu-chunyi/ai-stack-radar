/**
 * RAG 工具：文档切块 + TF-IDF 检索（纯数学，零 ML 模型）
 *
 * 三步流程：
 *   1) 加载文档 → 按段落切块 (chunk)
 *   2) 对每块计算 TF-IDF 向量
 *   3) 用户提问 → 也算 TF-IDF → 余弦相似度排序 → 返回 top-K 块
 *
 * 为什么先用 TF-IDF 不用 Embedding？
 *   - 让你先看清 RAG 的 PATTERN（切 → 搜 → 塞 → 答），不被"向量模型"遮蔽
 *   - TF-IDF 是信息检索的经典算法，面试也会问
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

// ===== 1. 文档切块 =====

export interface Chunk {
  id: number;
  source: string;   // 文件名
  heading: string;   // 所属标题
  text: string;      // 段落内容
}

/**
 * 按 markdown 标题（## / ###）切块。
 * 每个"标题 + 其下内容"是一个 chunk。
 */
export function chunkMarkdown(filePath: string): Chunk[] {
  const raw = readFileSync(filePath, "utf-8");
  const source = basename(filePath);
  const chunks: Chunk[] = [];
  let currentHeading = source;
  let buffer = "";

  for (const line of raw.split("\n")) {
    if (/^#{1,3}\s/.test(line)) {
      // 遇到新标题 → 把之前的 buffer 存为一个 chunk
      if (buffer.trim().length > 30) {
        chunks.push({ id: chunks.length, source, heading: currentHeading, text: buffer.trim() });
      }
      currentHeading = line.replace(/^#+\s*/, "").trim();
      buffer = "";
    } else {
      buffer += line + "\n";
    }
  }
  // 最后一段
  if (buffer.trim().length > 30) {
    chunks.push({ id: chunks.length, source, heading: currentHeading, text: buffer.trim() });
  }
  return chunks;
}

// ===== 2. TF-IDF 计算 =====

/** 中英文简单分词：按空格/标点切，转小写 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, " ")  // 保留中英文和数字
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** 词频 TF(word, doc) = 该词在 doc 中出现次数 / doc 总词数 */
function tf(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const total = tokens.length || 1;
  for (const [k, v] of freq) freq.set(k, v / total);
  return freq;
}

/** 逆文档频率 IDF(word) = log(总文档数 / 包含该词的文档数) */
function idf(corpus: string[][]): Map<string, number> {
  const docCount = corpus.length;
  const df = new Map<string, number>();
  for (const doc of corpus) {
    const seen = new Set(doc);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const result = new Map<string, number>();
  for (const [k, v] of df) result.set(k, Math.log(docCount / v));
  return result;
}

/** 余弦相似度 */
function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, magA = 0, magB = 0;
  for (const [k, v] of a) {
    dot += v * (b.get(k) ?? 0);
    magA += v * v;
  }
  for (const [, v] of b) magB += v * v;
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ===== 3. 检索引擎 =====

export class TfIdfRetriever {
  private chunks: Chunk[] = [];
  private vectors: Map<string, number>[] = [];
  private idfMap: Map<string, number> = new Map();

  /** 索引：加载所有文档切块 */
  index(filePaths: string[]) {
    for (const fp of filePaths) {
      this.chunks.push(...chunkMarkdown(fp));
    }
    const corpus = this.chunks.map((c) => tokenize(c.text));
    this.idfMap = idf(corpus);
    this.vectors = corpus.map((tokens) => {
      const tfMap = tf(tokens);
      const vec = new Map<string, number>();
      for (const [k, v] of tfMap) vec.set(k, v * (this.idfMap.get(k) ?? 0));
      return vec;
    });
    return { totalChunks: this.chunks.length };
  }

  /** 检索：返回最相关的 top-K 块 */
  search(query: string, topK = 3): Array<Chunk & { score: number }> {
    const qTokens = tokenize(query);
    const qTf = tf(qTokens);
    const qVec = new Map<string, number>();
    for (const [k, v] of qTf) qVec.set(k, v * (this.idfMap.get(k) ?? 0));

    return this.chunks
      .map((chunk, i) => ({ ...chunk, score: cosineSim(qVec, this.vectors[i]!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter((r) => r.score > 0);
  }
}
