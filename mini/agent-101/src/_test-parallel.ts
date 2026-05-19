/**
 * 验证：「并发」这件事到底是 LLM 决定的还是我们决定的？
 *
 * 真相：两层
 *   1) LLM 决定「同一回合里要调几个工具」——它返回 tool_calls: [tc1, tc2, ..., tc9]
 *   2) 我们的代码决定「这 9 个调用串行跑 还是 并行跑」
 *
 * 现在 L4 用的是 for...of (串行)。本脚本同样的任务跑两次：
 *   - 串行：for...of + await
 *   - 并行：Promise.all
 * 看时间差。
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { filesystemSchemas, runFilesystemTool } from "./tools/filesystem.js";

const question = `分析 src 目录，统计 .ts 文件数 + 列出所有 console.log 行（按文件分组）。`;
const MAX_TURNS = 15;

async function run(mode: "serial" | "parallel") {
  const startedAt = Date.now();
  let toolCallCount = 0;
  let maxParallelInOneTurn = 0;

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: "你是文件分析助手。只能用 list_files/read_file/grep 工具，禁止编造。",
    },
    { role: "user", content: question },
  ];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const res = await llm.chat.completions.create({
      model: MODEL,
      messages,
      tools: filesystemSchemas,
    });
    const msg = res.choices[0]!.message;
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      return {
        mode,
        ms: Date.now() - startedAt,
        turns: turn,
        toolCalls: toolCallCount,
        maxParallelInOneTurn,
      };
    }

    maxParallelInOneTurn = Math.max(maxParallelInOneTurn, msg.tool_calls.length);
    toolCallCount += msg.tool_calls.length;

    // ⬇⬇⬇ 关键差异在这里 ⬇⬇⬇
    if (mode === "serial") {
      // 模式 A：串行 —— 一个一个跑（L4 当前行为）
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        const args = JSON.parse(tc.function.arguments);
        let resultStr: string;
        try {
          resultStr = JSON.stringify(runFilesystemTool(tc.function.name, args));
        } catch (e) {
          resultStr = `Error: ${(e as Error).message}`;
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content: resultStr });
      }
    } else {
      // 模式 B：并行 —— Promise.all，9 个 grep 同时跑
      const toolMsgs = await Promise.all(
        msg.tool_calls.map(async (tc) => {
          if (tc.type !== "function") throw new Error("not function");
          const args = JSON.parse(tc.function.arguments);
          let resultStr: string;
          try {
            resultStr = JSON.stringify(runFilesystemTool(tc.function.name, args));
          } catch (e) {
            resultStr = `Error: ${(e as Error).message}`;
          }
          return { role: "tool" as const, tool_call_id: tc.id, content: resultStr };
        }),
      );
      messages.push(...toolMsgs);
    }
  }
  throw new Error(`超过 ${MAX_TURNS} 轮`);
}

async function main() {
  console.log("🏁 串行版本（当前 L4 行为）...");
  const a = await run("serial");
  console.log("  ✅", a);

  console.log("\n🏁 并行版本（Promise.all）...");
  const b = await run("parallel");
  console.log("  ✅", b);

  console.log("\n📊 对比");
  console.table([a, b]);

  console.log(`
💡 解读：
  - turns 和 toolCalls 两次基本一致 → 说明 LLM 调度（调几次工具、每次几个）是它自己决定的
  - maxParallelInOneTurn 显示某一轮 LLM 一次发了多少个 tool_call（这是 LLM 主动并发）
  - ms 差异 = 我们代码层串行 vs Promise.all 带来的真实加速
  - 但注意：本地文件工具本身极快，主要时间花在 LLM 网络往返上，加速比不会很夸张
    如果工具是「请求 9 个 API / 跑 9 个 SQL」，加速比会非常明显
`);
}
main().catch(console.error);
