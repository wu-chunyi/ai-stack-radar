/**
 * MCP Server · 把 L4-L6 的工具暴露给任何 MCP 客户端
 *
 * 协议层：JSON-RPC over stdio
 *   - tools/list：告诉客户端有哪些工具
 *   - tools/call：客户端调用工具，我们执行并返回结果
 *
 * 工具层：直接复用已有代码
 *   - list_files、read_file、grep、write_file（来自 tools/filesystem.ts）
 *   - run_command（来自 tools/shell.ts）
 *
 * 启动后 Claude Desktop / Cursor 等客户端通过 stdio 跟这个进程通信：
 *   客户端 → stdin → 我们的 Server → 执行工具 → stdout → 客户端
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { listFiles, readFile, grep, writeFile } from "./tools/filesystem.js";
import { runCommand } from "./tools/shell.js";

// ===== 1. 创建 MCP Server 实例 =====

const server = new Server(
  { name: "agent-101-tools", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// ===== 2. 响应 tools/list：告诉客户端有哪些工具 =====

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_files",
      description: "列出指定目录下的所有文件和子目录（限沙盒内）。",
      inputSchema: {
        type: "object",
        properties: { dir: { type: "string", description: "目录相对路径" } },
        required: ["dir"],
      },
    },
    {
      name: "read_file",
      description: "读取指定文件的完整内容（最多 50KB）。",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "文件相对路径" } },
        required: ["path"],
      },
    },
    {
      name: "grep",
      description: "在单个文件里用 JS 正则搜索所有匹配行，返回行号和内容。",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "JS 正则" },
          path: { type: "string", description: "文件相对路径" },
        },
        required: ["pattern", "path"],
      },
    },
    {
      name: "write_file",
      description: "将内容写入文件（自动创建目录，覆盖已有文件）。",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件相对路径" },
          content: { type: "string", description: "文件完整内容" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "run_command",
      description: "在项目目录执行 shell 命令，返回 stdout/stderr/exitCode。超时 15 秒。",
      inputSchema: {
        type: "object",
        properties: { command: { type: "string", description: "shell 命令" } },
        required: ["command"],
      },
    },
  ],
}));

// ===== 3. 响应 tools/call：真正执行工具 =====

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    let result: unknown;

    switch (name) {
      case "list_files":
        result = listFiles(args as { dir: string });
        break;
      case "read_file":
        result = readFile(args as { path: string });
        break;
      case "grep":
        result = grep(args as { pattern: string; path: string });
        break;
      case "write_file":
        result = writeFile(args as { path: string; content: string });
        break;
      case "run_command":
        result = runCommand(args as { command: string });
        break;
      default:
        throw new Error(`未知工具: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

// ===== 4. 启动：通过 stdio 监听客户端连接 =====

const transport = new StdioServerTransport();
await server.connect(transport);

// server 启动后不退出，持续等待客户端请求
// 客户端通过 stdin 发 JSON-RPC 请求，我们通过 stdout 回复
