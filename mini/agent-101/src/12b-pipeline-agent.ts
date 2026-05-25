/**
 * L12b · 真正有价值的多 Agent：代码审查流水线
 *
 * 对比 L12（正反辩论）：
 *   L12  - Researcher + Critic 搜不同词，收益来自"不同检索路径"而非"不同视角"
 *   L12b - 三个 Agent 拥有不同工具权限，做真实不同的事，缺一不可
 *
 * 流水线：
 *   Bug Detector  → 只能读文件（只读，发现问题）
 *        ↓ 把 bug 报告传下去
 *   Fix Writer    → 只能写文件（只写，生成修复）
 *        ↓ 把修改后的文件路径传下去
 *   Verifier      → 只能运行命令（只运行，验证结果）
 *
 * 为什么这种分工有意义（vs 单 Agent）：
 *   1. 每个 Agent 的 context 专注一件事，不会互相干扰
 *   2. Bug Detector 看到干净的原始代码，不受"我想怎么修"的先入为主
 *   3. Verifier 不知道修了什么，只看结果对不对 → 客观
 *   4. 工具权限隔离：Detector 物理上不能修改文件（防止越权）
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { readFile, writeFile } from "./tools/filesystem.js";
import { runCommand } from "./tools/shell.js";

// ===== 工具 schemas（三个 Agent 用不同子集）=====

const READ_ONLY_TOOLS = [{
  type: "function" as const,
  function: {
    name: "read_file",
    description: "读取文件内容",
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
}];

const WRITE_ONLY_TOOLS = [{
  type: "function" as const,
  function: {
    name: "write_file",
    description: "将修复后的完整代码写入文件",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
}];

const RUN_ONLY_TOOLS = [{
  type: "function" as const,
  function: {
    name: "run_command",
    description: "运行 shell 命令验证结果",
    parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
  },
}];

// ===== 通用 Agent loop =====

type ToolSchema = typeof READ_ONLY_TOOLS;
type DispatchFn = (name: string, args: Record<string, string>) => string;

async function runAgent(
  role: string,
  system: string,
  user: string,
  tools: ToolSchema,
  dispatch: DispatchFn,
  maxTurns = 6,
): Promise<string> {
  console.log(`\n${"─".repeat(40)}`);
  console.log(`[${role}] 启动（工具权限: ${tools.map(t => t.function.name).join(", ")}）`);
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  for (let i = 1; i <= maxTurns; i++) {
    const res = await llm.chat.completions.create({ model: MODEL, messages, tools });
    const msg = res.choices[0]!.message;
    messages.push(msg);
    if (!msg.tool_calls?.length) {
      console.log(`[${role}] 完成 ✓`);
      return msg.content ?? "";
    }
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments) as Record<string, string>;
      const preview = Object.values(args)[0]?.slice(0, 50) ?? "";
      console.log(`  🔧 ${tc.function.name}("${preview}")`);
      const result = dispatch(tc.function.name, args);
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }
  return "(超时)";
}

// ===== 流水线 =====

async function reviewPipeline(targetFile: string) {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`🔄 代码审查流水线: ${targetFile}`);
  console.log(`${"═".repeat(50)}`);

  // Agent 1: Bug Detector（只读）
  const bugs = await runAgent(
    "Bug Detector",
    "你是代码审查专家。读取目标文件，列出所有 bug（编号，给出行号和原因）。只读不写。",
    `请审查文件 ${targetFile}，找出所有 bug。`,
    READ_ONLY_TOOLS,
    (name, args) => name === "read_file" ? readFile(args as { path: string }) : "权限不足",
  );

  console.log(`\n📋 Bug 报告:\n${bugs.slice(0, 300)}...`);

  // Agent 2: Fix Writer（只写，收到 bug 报告）
  const fixReport = await runAgent(
    "Fix Writer",
    "你是修复工程师。你会收到 bug 报告，用 write_file 把修复后的完整代码写回文件。只写不读。",
    `Bug 报告：\n${bugs}\n\n请修复这些 bug，用 write_file 把完整修复后的代码写回 ${targetFile}`,
    WRITE_ONLY_TOOLS,
    (name, args) => {
      if (name === "write_file") return writeFile(args as { path: string; content: string });
      return "权限不足：Fix Writer 只能写文件，不能读";
    },
  );

  // Agent 3: Verifier（只跑命令，不知道修了什么）
  const verdict = await runAgent(
    "Verifier",
    "你是测试工程师。你不知道代码改了什么，只需要运行代码验证结果是否符合预期。" +
    `运行命令 "npx tsx ${targetFile}"，看输出是否包含 ✅ PASS。`,
    `请运行 ${targetFile} 验证修复是否成功。`,
    RUN_ONLY_TOOLS,
    (name, args) => {
      if (name === "run_command") {
        const r = runCommand(args as { command: string });
        return JSON.stringify(r);
      }
      return "权限不足";
    },
  );

  console.log(`\n${"═".repeat(50)}`);
  console.log("🏁 Verifier 最终判定:");
  console.log(verdict.slice(0, 300));
  console.log(`${"═".repeat(50)}`);

  console.log(`\n💡 为什么这种多 Agent 比辩论模式更有价值：`);
  console.log("  Bug Detector 看到干净代码 → 不受「我想怎么修」的先入之见");
  console.log("  Fix Writer 不重新读文件 → 专注执行 Detector 的报告");
  console.log("  Verifier 不知道修了什么 → 完全客观的黑盒测试");
  console.log("  工具权限隔离：Detector 物理上无法修改文件（防越权）");
}

// 先把 buggy.ts 恢复成有 bug 的状态，再跑流水线
async function main() {
  // 确认 buggy.ts 当前状态
  const content = readFile({ path: "src/buggy.ts" });
  if (content.includes("i < users.length")) {
    console.log("ℹ️  buggy.ts 已经是修复状态，重置为有 bug 的版本...");
    const bugged = content
      .replace("i < users.length", "i <= users.length")
      .replace(/if \(!user\) continue;\n\n    /, "")
      .replace(/    \/\/ 修复 Bug 3: 恢复 email 校验\n    if/, "    // if")
      .replace(/      errors\.push\(`\$\{user\.name\}: email "\$\{user\.email\}" is invalid`\);\n    \}/, '      //errors.push(`${user.name}: email "${user.email}" is invalid`);\n    //}');
    writeFile({ path: "src/buggy.ts", content: bugged });
  }
  await reviewPipeline("src/buggy.ts");
}

main().catch((e) => { console.error(e); process.exit(1); });
