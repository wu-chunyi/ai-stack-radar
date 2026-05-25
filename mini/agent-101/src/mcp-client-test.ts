/**
 * MCP 客户端测试 · 模拟 Claude Desktop 跟 MCP Server 通信的过程
 *
 * 这个脚本就是 Claude Desktop 内部在做的事：
 *   1. 启动 MCP Server 进程
 *   2. 发 tools/list 问"你有什么工具？"
 *   3. 发 tools/call 调用具体工具
 *   4. 把工具结果用给 LLM
 *
 * 通信格式：JSON-RPC 2.0 over stdio
 *   客户端 → Server stdin  : {"jsonrpc":"2.0","id":1,"method":"tools/list",...}
 *   Server → 客户端 stdout : {"jsonrpc":"2.0","id":1,"result":{...}}
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const SERVER_SCRIPT = resolve(import.meta.dirname, "mcp-server.ts");

// ===== MCP 客户端封装 =====

class McpClient {
  private proc: ReturnType<typeof spawn>;
  private rl: ReturnType<typeof createInterface>;
  private pending = new Map<number, (res: unknown) => void>();
  private nextId = 1;

  constructor() {
    this.proc = spawn("npx", ["tsx", SERVER_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.rl = createInterface({ input: this.proc.stdout! });
    // 每收到一行就解析成 JSON-RPC 响应，找到对应请求的回调
    this.rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line) as { id: number; result?: unknown; error?: unknown };
        this.pending.get(msg.id)?.(msg.result ?? msg.error);
        this.pending.delete(msg.id);
      } catch {}
    });
    this.proc.stderr?.on("data", () => {}); // 忽略 server 的 stderr 输出
  }

  // 发一条 JSON-RPC 请求，等待响应
  request(method: string, params: unknown = {}): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      this.proc.stdin!.write(msg + "\n");
    });
  }

  close() { this.proc.kill(); }
}

// ===== 测试：模拟 Claude Desktop 的行为 =====

async function main() {
  console.log("🚀 启动 MCP Server...\n");
  const client = new McpClient();
  await new Promise((r) => setTimeout(r, 800)); // 等 server 启动

  // ── 步骤 1: tools/list ──────────────────────────────────────────
  console.log("📋 Step 1: Claude Desktop 问「你有什么工具？」");
  console.log("发送: {\"method\": \"tools/list\"}\n");
  const toolsResult = await client.request("tools/list") as { tools: Array<{ name: string; description: string }> };
  console.log(`收到 ${toolsResult.tools.length} 个工具：`);
  for (const t of toolsResult.tools) console.log(`  🔧 ${t.name}: ${t.description}`);

  // ── 步骤 2: tools/call list_files ───────────────────────────────
  console.log("\n📂 Step 2: Claude 决定调用 list_files");
  console.log("发送: {\"method\": \"tools/call\", \"name\": \"list_files\", \"dir\": \"src\"}\n");
  const listResult = await client.request("tools/call", {
    name: "list_files",
    arguments: { dir: "src" },
  }) as { content: Array<{ text: string }> };
  const files = JSON.parse(listResult.content[0]!.text) as Array<{ name: string; type: string }>;
  console.log("收到文件列表：");
  for (const f of files) console.log(`  ${f.type === "dir" ? "📁" : "📄"} ${f.name}`);

  // ── 步骤 3: tools/call run_command ──────────────────────────────
  console.log("\n⚡ Step 3: Claude 决定运行命令");
  console.log("发送: {\"method\": \"tools/call\", \"name\": \"run_command\", \"command\": \"echo MCP works\"}\n");
  const cmdResult = await client.request("tools/call", {
    name: "run_command",
    arguments: { command: "echo 'MCP works! 🎉'" },
  }) as { content: Array<{ text: string }> };
  const cmdOutput = JSON.parse(cmdResult.content[0]!.text);
  console.log("收到命令输出：", cmdOutput.stdout.trim());

  // ── 步骤 4: tools/call grep ─────────────────────────────────────
  console.log("\n🔍 Step 4: Claude 搜索代码");
  const grepResult = await client.request("tools/call", {
    name: "grep",
    arguments: { pattern: "export function", path: "src/tools/filesystem.ts" },
  }) as { content: Array<{ text: string }> };
  const matches = JSON.parse(grepResult.content[0]!.text) as Array<{ line: number; text: string }>;
  console.log(`在 filesystem.ts 找到 ${matches.length} 个 export function：`);
  for (const m of matches) console.log(`  行 ${m.line}: ${m.text.trim()}`);

  console.log("\n════════════════════════════════════");
  console.log("✅ MCP 通信测试完成！");
  console.log("\n💡 这就是 Claude Desktop 在做的事：");
  console.log("   1. 启动你的 MCP Server 进程");
  console.log("   2. 发 tools/list 获取工具列表");
  console.log("   3. 用户提问 → Claude 决定调哪个工具 → 发 tools/call");
  console.log("   4. 把工具结果塞进 context → Claude 给出最终回答");
  console.log("   区别只有一个：真正的 Claude Desktop 里是真实的 Claude LLM 在决策");
  console.log("════════════════════════════════════");

  client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
