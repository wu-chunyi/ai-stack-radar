/**
 * Agent 共享工具集
 *
 * 多 Agent 系统里，不同角色的 Agent 可以用不同的工具子集。
 * 这里封装给 Agent 用的工具：搜索工具库 + 读取工具详情
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const DATA_DIR = resolve(import.meta.dirname, "../../data/synthetic");
const REAL_DOCS_DIR = resolve(import.meta.dirname, "../../../docs");

/** 在所有工具文档里做关键词搜索 */
export function searchToolDocs(query: string, topK = 3): string {
  const q = query.toLowerCase();
  try {
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".md"));
    const results = files
      .map((f) => {
        const content = readFileSync(join(DATA_DIR, f), "utf-8");
        const score = (content.toLowerCase().match(new RegExp(q.split(" ").join("|"), "g")) ?? []).length;
        return { name: basename(f, ".md"), content, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    if (!results.length) return `未找到与"${query}"相关的工具`;
    return results.map((r) => `### ${r.name}\n${r.content.slice(0, 600)}...`).join("\n\n---\n\n");
  } catch {
    return "工具库暂不可用";
  }
}

/** 读取指定工具的完整评测 */
export function getToolDetail(toolName: string): string {
  const slug = toolName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  try {
    const files = readdirSync(DATA_DIR);
    const match = files.find((f) =>
      f.toLowerCase().includes(slug) || f.replace(".md", "").toLowerCase() === slug,
    );
    if (!match) return `未找到工具: ${toolName}`;
    return readFileSync(join(DATA_DIR, match), "utf-8");
  } catch {
    return `读取失败: ${toolName}`;
  }
}

// ===== 暴露给 LLM 的 schemas =====

export const agentTools = {
  researcher: [
    {
      type: "function" as const,
      function: {
        name: "search_tool_docs",
        description: "搜索 AI 工具数据库，找到与查询最相关的工具信息",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "搜索关键词" } },
          required: ["query"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_tool_detail",
        description: "获取指定工具的完整评测（功能、定价、优缺点）",
        parameters: {
          type: "object",
          properties: { tool_name: { type: "string", description: "工具名称" } },
          required: ["tool_name"],
        },
      },
    },
  ],
};

export function runAgentTool(name: string, args: Record<string, string>): string {
  switch (name) {
    case "search_tool_docs": return searchToolDocs(args.query ?? "");
    case "get_tool_detail": return getToolDetail(args.tool_name ?? "");
    default: return `未知工具: ${name}`;
  }
}
