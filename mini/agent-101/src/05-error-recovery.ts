/**
 * L5 · Agent 错误恢复
 *
 * 目标：让你看到 agent 遇到工具报错后的完整行为链：
 *   1) 调工具 → 报错
 *   2) 错误作为 tool result 塞回 messages
 *   3) LLM 看到错误 → 调整策略（换路径、换工具、或自己创建）
 *   4) 继续循环
 *
 * 任务：故意让 agent 去读一个不存在的文件 "src/config.ts"
 *       然后看它怎么处理：
 *       - 先 list_files 发现没有 config.ts
 *       - 或者直接 read_file 报 ENOENT
 *       - 然后根据提示自己创建一个
 *
 * 关键点：while 循环和 L4 一模一样，一个字没改。
 *         自我恢复的能力来自「错误也是观察」这个设计。
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { filesystemSchemas, runFilesystemTool } from "./tools/filesystem.js";

const task = `请完成以下任务：
1. 读取 src/config.ts 文件的内容
2. 如果文件不存在，就创建它，写入一个简单的配置对象导出（包含 appName, version, debug 三个字段）
3. 最后再读一次，确认文件内容正确，然后告诉我最终内容`;

const MAX_TURNS = 15;

async function runAgent(input: string): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "你是文件管理助手。你只能通过 list_files / read_file / grep / write_file 工具操作文件系统。" +
        "禁止编造文件内容。遇到错误时分析原因并尝试恢复。",
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

    // 如果 LLM 有思考过程（reasoning），打印出来
    if (msg.content) {
      console.log(`  💭 LLM 思考: ${msg.content.slice(0, 120)}${msg.content.length > 120 ? "..." : ""}`);
    }

    if (!msg.tool_calls?.length) {
      console.log("  🏁 LLM 决定不再调工具。");
      return msg.content ?? "(空)";
    }

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments);
      const argsPreview = JSON.stringify(args).slice(0, 100);
      console.log(`  🔧 ${tc.function.name}(${argsPreview})`);

      let resultStr: string;
      try {
        const result = runFilesystemTool(tc.function.name, args);
        resultStr = JSON.stringify(result);
        const preview = resultStr.length > 200 ? resultStr.slice(0, 200) + "…" : resultStr;
        console.log(`  ✅ ${preview}`);
      } catch (err) {
        // ⬇⬇⬇ 这里是 L5 的核心：错误不抛出，而是变成 tool result ⬇⬇⬇
        resultStr = `Error: ${(err as Error).message}`;
        console.log(`  ❌ ${resultStr}`);
        // LLM 下一轮会看到这个 Error 字符串，然后自己决定怎么办
      }

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: resultStr,
      });
    }
  }
  throw new Error(`超过 ${MAX_TURNS} 轮`);
}

async function main() {
  console.log("📝 任务：\n" + task);
  console.log("⚠️  注意：src/config.ts 目前不存在，agent 会遇到错误");

  const answer = await runAgent(task);

  console.log("\n════════════════════════════════");
  console.log("🎯 Agent 最终回答：\n");
  console.log(answer);
  console.log("════════════════════════════════");

  console.log(`
💡 复盘 - 你刚才看到的错误恢复链：
   1. agent 尝试 read_file("src/config.ts")
   2. 工具抛 ENOENT → catch 把 "Error: ..." 塞进 messages
   3. LLM 看到 Error → 「文件不存在，我需要创建」
   4. agent 调 write_file 创建文件
   5. agent 调 read_file 验证 → 成功
   6. 给出最终回答

   关键设计：错误不是异常，是「观察」。
   try/catch 那 3 行代码 = agent 全部的自我修复能力。
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
