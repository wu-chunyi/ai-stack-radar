/**
 * AI Stack Radar MCP Server
 *
 * 类比 Figma MCP：把 AI 工具数据库暴露给任何 MCP 客户端。
 * 完整使用 MCP 的三个原语：
 *
 *   ❶ Tools    - 可调用的操作（搜索、获取详情、对比）
 *   ❷ Resources - 可浏览的内容（工具库列表、单个工具页）
 *   ❸ Prompts  - 可复用的提示词模板（推荐、对比）
 *
 * 数据来源：data/synthetic/*.md（40 个 AI 工具评测文档）
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join, basename } from "node:path";

const DATA_DIR = resolve(import.meta.dirname, "../data/synthetic");

// ===== 数据层：解析工具文档 =====

interface Tool {
  slug: string;        // cursor, devin, langraph ...
  name: string;
  content: string;     // 完整 markdown
  summary: string;     // 前 200 字
}

function loadTools(): Tool[] {
  try {
    return readdirSync(DATA_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const content = readFileSync(join(DATA_DIR, f), "utf-8");
        const slug = basename(f, ".md");
        const nameMatch = content.match(/^#\s+(.+)/m);
        const name = nameMatch ? nameMatch[1]!.replace(" 评测", "").trim() : slug;
        return { slug, name, content, summary: content.slice(0, 200).replace(/\n/g, " ") };
      });
  } catch {
    return [];
  }
}

// 简单关键词搜索（生产中换 Embedding）
function searchTools(tools: Tool[], query: string): Tool[] {
  const q = query.toLowerCase();
  return tools
    .map((t) => ({
      tool: t,
      score: (t.content.toLowerCase().match(new RegExp(q.split(" ").join("|"), "g")) ?? []).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.tool);
}

// ===== 服务器初始化 =====

const server = new Server(
  { name: "ai-stack-radar", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

// ===== ❶ Tools（可调用的操作）=====

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_tools",
      description: "在 AI 工具数据库中搜索工具，返回最相关的结果。",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
    {
      name: "get_tool",
      description: "获取指定 AI 工具的完整评测内容（简介、功能、定价、优缺点）。",
      inputSchema: { type: "object", properties: { name: { type: "string", description: "工具名或 slug" } }, required: ["name"] },
    },
    {
      name: "list_tools",
      description: "列出数据库中所有 AI 工具的名称和简介。",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "compare_tools",
      description: "对比多个 AI 工具，返回它们的信息供对比分析。",
      inputSchema: {
        type: "object",
        properties: { names: { type: "array", items: { type: "string" }, description: "工具名列表" } },
        required: ["names"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tools = loadTools();
  const { name, arguments: args } = req.params;
  const a = args as Record<string, unknown>;

  try {
    let result: unknown;
    switch (name) {
      case "search_tools": {
        const hits = searchTools(tools, String(a.query));
        result = hits.length ? hits.map((t) => ({ name: t.name, slug: t.slug, summary: t.summary })) : "未找到相关工具";
        break;
      }
      case "get_tool": {
        const q = String(a.name).toLowerCase();
        const t = tools.find((x) => x.slug === q || x.name.toLowerCase().includes(q));
        result = t ? t.content : `未找到工具: ${a.name}`;
        break;
      }
      case "list_tools":
        result = tools.map((t) => ({ name: t.name, slug: t.slug, summary: t.summary }));
        break;
      case "compare_tools": {
        const names = (a.names as string[]).map((n) => n.toLowerCase());
        const found = tools.filter((t) => names.some((n) => t.slug.includes(n) || t.name.toLowerCase().includes(n)));
        result = found.map((t) => ({ name: t.name, content: t.content }));
        break;
      }
      default: throw new Error(`未知工具: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
  }
});

// ===== ❷ Resources（可浏览的内容）=====

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const tools = loadTools();
  return {
    resources: [
      { uri: "ai-tools://catalog", name: "AI 工具目录", description: `${tools.length} 个工具的完整目录`, mimeType: "text/plain" },
      ...tools.map((t) => ({
        uri: `ai-tools://tool/${t.slug}`,
        name: t.name,
        description: t.summary,
        mimeType: "text/markdown",
      })),
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const tools = loadTools();
  const uri = req.params.uri;
  if (uri === "ai-tools://catalog") {
    const catalog = tools.map((t) => `## ${t.name}\n${t.summary}`).join("\n\n---\n\n");
    return { contents: [{ uri, mimeType: "text/plain", text: catalog }] };
  }
  const slug = uri.replace("ai-tools://tool/", "");
  const tool = tools.find((t) => t.slug === slug);
  if (!tool) throw new Error(`工具不存在: ${slug}`);
  return { contents: [{ uri, mimeType: "text/markdown", text: tool.content }] };
});

// ===== ❸ Prompts（可复用的提示词模板）=====

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    { name: "recommend_tool", description: "根据需求推荐最合适的 AI 工具", arguments: [{ name: "requirement", description: "你的需求描述", required: true }] },
    { name: "compare_tools", description: "深度对比多个工具的优缺点", arguments: [{ name: "tools", description: "逗号分隔的工具名", required: true }] },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const a = args as Record<string, string> | undefined ?? {};
  if (name === "recommend_tool") {
    return { messages: [{ role: "user", content: { type: "text", text: `我的需求是：${a.requirement}\n\n请先用 search_tools 搜索相关工具，然后用 get_tool 获取详情，最后给出推荐理由。` } }] };
  }
  if (name === "compare_tools") {
    return { messages: [{ role: "user", content: { type: "text", text: `请用 compare_tools 工具对比以下工具：${a.tools}\n然后列出每个工具的核心差异、适用场景和最终推荐。` } }] };
  }
  throw new Error(`未知 prompt: ${name}`);
});

// ===== 启动 =====

const transport = new StdioServerTransport();
await server.connect(transport);
