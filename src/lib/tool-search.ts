/**
 * AI 工具搜索库（服务端，Next.js API Route 用）
 *
 * 读取 mini/agent-101/data/synthetic/ 下的 40 个工具评测文档
 * 做关键词搜索，返回最相关的几篇作为 RAG 上下文
 *
 * 为什么不用 Embedding？
 * - API Route 每次请求都要向量化，延迟高、成本高
 * - 工具名、技术术语关键词匹配效果已经很好
 * - 生产环境可以替换为预计算的 LanceDB（把 L11 的代码接进来）
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "mini/agent-101/data/synthetic");

export interface ToolDoc {
  slug: string;
  name: string;
  content: string;
  summary: string;
}

function loadAllTools(): ToolDoc[] {
  try {
    return readdirSync(DATA_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const content = readFileSync(join(DATA_DIR, f), "utf-8");
        const slug = f.replace(".md", "");
        const nameMatch = content.match(/^#\s+(.+)/m);
        const name = nameMatch?.[1]?.replace("评测", "").trim() ?? slug;
        return {
          slug,
          name,
          content,
          summary: content.slice(0, 300).replace(/\n+/g, " "),
        };
      });
  } catch {
    return [];
  }
}

export function searchTools(query: string, topK = 5): ToolDoc[] {
  const tools = loadAllTools();
  const keywords = query.toLowerCase().split(/\s+/);

  return tools
    .map((t) => {
      const text = t.content.toLowerCase();
      const score = keywords.reduce((acc, kw) => {
        const matches = text.match(new RegExp(kw, "g")) ?? [];
        return acc + matches.length;
      }, 0);
      return { ...t, score };
    })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function buildContext(tools: ToolDoc[]): string {
  if (!tools.length) return "暂无相关工具数据。";
  return tools
    .map((t) => `### ${t.name}\n${t.content.slice(0, 800)}`)
    .join("\n\n---\n\n");
}
