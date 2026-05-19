/**
 * L4 · 文件助手 Agent —— Agent 真正发光的场景
 *
 * 任务：分析 src/ 目录，统计 .ts 文件数 + 列出所有 TODO/console.log 行
 *
 * 关键观察（对比 L3 calculator）：
 *   1) LLM 完全不知道你的文件系统长啥样，**它必须真的去看**
 *   2) 每个工具结果都是磁盘上的事实，LLM 编不出来也猜不到
 *   3) 下一步调什么工具，完全取决于上一步看到的真实结果
 *      （list_files 看到 tools/ → 才会再 list_files("src/tools") → 才会 grep 每个 .ts）
 *   4) 这是 agent 不可替代的地方：「在真实世界里探索 + 行动」
 *
 * 而 **agent loop 本身和 L3 一模一样**：还是 while + tool_calls + tool result push back。
 * 这就是为什么我说「学懂这个 while，所有 agent 框架都是它的变体」。
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { filesystemSchemas, runFilesystemTool } from "./tools/filesystem.js";

const question = `请帮我分析当前的 src 目录：
1. 一共有几个 .ts 文件（含子目录）？
2. 把所有包含 "TODO" 或 "console.log" 的行列出来，按文件分组，每条带行号。`;

const MAX_TURNS = 20;

async function runAgent(input: string): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "你是文件分析助手。你只能通过 list_files / read_file / grep 工具了解文件系统，" +
        "禁止编造路径或文件内容。每个结论都必须基于工具返回的真实结果。",
    },
    { role: "user", content: input },
  ];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    console.log(`\n──────── 轮 ${turn} ────────`);

    const res = await llm.chat.completions.create({
      model: MODEL,
      messages,
      tools: filesystemSchemas,
    });
    const msg = res.choices[0]!.message;
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      console.log("🤖 LLM 决定不再调工具，给出最终回答。");
      return msg.content ?? "(空)";
    }

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments);
      console.log(`  🔧 ${tc.function.name}(${JSON.stringify(args)})`);

      let resultStr: string;
      try {
        const result = runFilesystemTool(tc.function.name, args);
        resultStr = JSON.stringify(result);
        const preview = resultStr.length > 240 ? resultStr.slice(0, 240) + "…" : resultStr;
        console.log(`  ✅ ${preview}`);
      } catch (err) {
        resultStr = `Error: ${(err as Error).message}`;
        console.log(`  ❌ ${resultStr}`);
      }

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: resultStr,
      });
    }
  }

  throw new Error(`超过 ${MAX_TURNS} 轮，强制终止`);
}

async function main() {
  console.log("📝 任务：\n" + question);
  const answer = await runAgent(question);
  console.log("\n════════════════════════");
  console.log("🎯 Agent 最终回答：\n");
  console.log(answer);
  console.log("════════════════════════");
  console.log(
    "\n💡 回头看：agent 的 while 循环和 L3 完全一样。" +
      "\n   变化的只是「工具」。Agent 工程的核心，就是「怎么设计好工具」。",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
