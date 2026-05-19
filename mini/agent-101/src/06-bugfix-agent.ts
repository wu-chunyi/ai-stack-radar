/**
 * L6 · 自动修 Bug Agent
 *
 * 这是前 5 节能力的综合运用：
 *   - 工具组合：read_file + write_file + grep + run_command（4 种工具）
 *   - 错误恢复：运行报错 → 读代码 → 修改 → 再运行（L5 的延伸）
 *   - 多轮循环：可能有多个 bug，修完一个还有下一个
 *
 * 任务：src/buggy.ts 有 3 个 bug，agent 需要全部修好直到程序输出 ✅ PASS。
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { filesystemSchemas, runFilesystemTool } from "./tools/filesystem.js";
import { runCommand, runCommandSchema } from "./tools/shell.js";

const task = `文件 src/buggy.ts 有 bug，运行 "npx tsx src/buggy.ts" 会报错或输出 FAIL。
请你：
1. 先运行看报错信息
2. 读源码定位问题
3. 修复代码（用 write_file 写回整个文件）
4. 再运行验证
5. 重复 2-4 直到输出 ✅ PASS
注意：可能不止一个 bug。`;

const MAX_TURNS = 20;

// 合并所有工具的 schema
const allTools = [...filesystemSchemas, runCommandSchema];

// 统一工具调度
function dispatch(name: string, args: unknown): unknown {
  if (name === "run_command") return runCommand(args as { command: string });
  return runFilesystemTool(name, args);
}

async function runAgent(input: string): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "你是高级 TypeScript 调试助手。你可以用 run_command 执行代码，" +
        "用 read_file 读源码，用 write_file 修改代码，用 grep 搜索。" +
        "修复策略：先运行看错误 → 读代码理解上下文 → 精准修复 → 再运行验证。" +
        "每次 write_file 必须写入完整文件内容（不是 diff）。" +
        "目标：让程序输出 ✅ PASS。",
    },
    { role: "user", content: input },
  ];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    console.log(`\n──────── 轮 ${turn} ────────`);

    const res = await llm.chat.completions.create({
      model: MODEL,
      messages,
      tools: allTools,
    });
    const msg = res.choices[0]!.message;
    messages.push(msg);

    if (msg.content) {
      const preview = msg.content.slice(0, 150);
      console.log(`  💭 ${preview}${msg.content.length > 150 ? "..." : ""}`);
    }

    if (!msg.tool_calls?.length) {
      console.log("  🏁 Agent 完成。");
      return msg.content ?? "(空)";
    }

    // 并行执行工具调用
    const toolResults = await Promise.all(
      msg.tool_calls.map(async (tc) => {
        if (tc.type !== "function") return null;
        const args = JSON.parse(tc.function.arguments);
        const argsStr = JSON.stringify(args).slice(0, 80);
        console.log(`  🔧 ${tc.function.name}(${argsStr})`);

        let resultStr: string;
        try {
          resultStr = JSON.stringify(dispatch(tc.function.name, args));
          const preview = resultStr.length > 300 ? resultStr.slice(0, 300) + "…" : resultStr;
          console.log(`  ${resultStr.includes("Error") || resultStr.includes("FAIL") ? "❌" : "✅"} ${preview}`);
        } catch (err) {
          resultStr = `Error: ${(err as Error).message}`;
          console.log(`  ❌ ${resultStr}`);
        }
        return { role: "tool" as const, tool_call_id: tc.id, content: resultStr };
      }),
    );
    messages.push(...toolResults.filter(Boolean) as typeof messages);
  }
  throw new Error(`超过 ${MAX_TURNS} 轮`);
}

async function main() {
  console.log("📝 任务：自动修复 src/buggy.ts 中的所有 bug");
  console.log("🐛 已知：文件埋了 3 个 bug（off-by-one / null access / 逻辑遗漏）\n");

  // 先让用户看一眼原始报错
  console.log("═══ 修复前运行结果 ═══");
  const before = runCommand({ command: "npx tsx src/buggy.ts 2>&1" });
  console.log(before.stdout || before.stderr);
  console.log("═══════════════════════\n");

  const answer = await runAgent(task);

  console.log("\n══════════════════════════════════");
  console.log("🎯 Agent 最终报告：\n");
  console.log(answer);
  console.log("══════════════════════════════════");
}

main().catch((e) => { console.error(e); process.exit(1); });
