/**
 * L2 · LLM + 1 个工具，手写「1 轮」tool-use
 *
 * 这一节我们手动做一次 tool-use 的完整往返：
 *   你 → LLM（告诉它有 calculator 工具）
 *   LLM → 我们（返回 tool_calls，要求调用 calculator）
 *   我们跑工具 → 把结果塞回 messages
 *   再问 LLM → LLM 给最终回答
 *
 * 注意：我们「只做 1 轮」，没有 while 循环。
 * 如果题目复杂到需要多次调用，这个写法就会卡住（LLM 第二次又想调工具但我们没处理）。
 * 这正是 L3 要解决的。
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { calculator, calculatorSchema, type CalcArgs } from "./tools/calculator.js";

// 故意用一个「简单到 1 步就能解」的题，让本节能跑完
const question = "13 乘以 47 等于多少？";

async function main() {
  console.log("📝 问题：", question);

  const messages: ChatCompletionMessageParam[] = [
    { role: "user", content: question },
  ];

  // === 第 1 次 LLM 调用：LLM 应该返回一个 tool_call ===
  console.log("\n[轮 1] → LLM（带 calculator 工具的 schema）");
  const first = await llm.chat.completions.create({
    model: MODEL,
    messages,
    tools: [calculatorSchema],
  });

  const firstMsg = first.choices[0]!.message;
  messages.push(firstMsg); // 把 LLM 的回复（包含 tool_calls）也推进对话

  if (!firstMsg.tool_calls?.length) {
    console.log("🤖 LLM 没调工具，直接回答：", firstMsg.content);
    return;
  }

  // === 跑工具 ===
  for (const tc of firstMsg.tool_calls) {
    if (tc.type !== "function") continue;
    const args = JSON.parse(tc.function.arguments) as CalcArgs;
    console.log(
      `[工具] LLM 请求调用 ${tc.function.name}(${args.a} ${args.op} ${args.b})`,
    );
    const result = calculator(args);
    console.log(`[工具] 返回结果: ${result}`);

    messages.push({
      role: "tool",
      tool_call_id: tc.id,
      content: String(result),
    });
  }

  // === 第 2 次 LLM 调用：LLM 看到工具结果，给出最终回答 ===
  console.log("\n[轮 2] → LLM（带上工具结果）");
  const second = await llm.chat.completions.create({
    model: MODEL,
    messages,
    tools: [calculatorSchema],
  });

  const finalMsg = second.choices[0]!.message;
  console.log("\n🤖 LLM 最终回答：", finalMsg.content);

  console.log(
    "\n💡 重点：tool-use 的本质就是「把 LLM 的输出 + 工具结果 反复塞回 messages」。",
  );
  console.log(
    "   但本节只跑了 1 轮。如果是 (((25+17)*3)-8)/2 这种复杂题，LLM 在轮 2 还会想调工具，",
  );
  console.log("   我们就没处理 → 下一节 03-agent-loop 用 while 循环解决。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
