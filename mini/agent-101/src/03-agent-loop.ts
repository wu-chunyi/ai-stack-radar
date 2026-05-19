/**
 * L3 · 真·Agent Loop ✅
 *
 * 把 L2 的「1 轮 tool-use」套上 while 循环 = agent。
 * 关键差别：LLM 调完工具看到结果，可以决定「我还要再调一次」，循环继续。
 *
 * 你将亲眼看到 LLM 把 (((25+17)*3)-8)/2 拆成 4 次顺序调用：
 *   call 1: 25 + 17 = 42
 *   call 2: 42 * 3  = 126
 *   call 3: 126 - 8 = 118
 *   call 4: 118 / 2 = 59
 * 最后 LLM 不再调工具，直接输出答案 → 循环结束。
 *
 * 这就是 agent。
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { calculator, calculatorSchema, type CalcArgs } from "./tools/calculator.js";

const question = "请计算 (((25 + 17) * 3) - 8) / 2，给出最终结果。";

// 安全阀：永远给 agent 一个最大轮数，防止 LLM 抽风死循环烧 token
const MAX_TURNS = 10;

async function runAgent(userInput: string): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "你是一个数学助手。你只能用 calculator 工具进行计算，禁止心算。每次只能算两数。",
    },
    { role: "user", content: userInput },
  ];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    console.log(`\n──────── 轮 ${turn} ────────`);

    // 1️⃣ 推理：把对话 + 工具丢给 LLM
    const res = await llm.chat.completions.create({
      model: MODEL,
      messages,
      tools: [calculatorSchema],
    });
    const msg = res.choices[0]!.message;
    messages.push(msg);

    // 2️⃣ 反思：LLM 不再调工具 → 任务完成，跳出循环
    if (!msg.tool_calls?.length) {
      console.log("🤖 LLM 决定不再调工具，给出最终回答。");
      return msg.content ?? "(空回答)";
    }

    // 3️⃣ 行动 + 观察：跑每个工具调用，把结果塞回 messages
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments) as CalcArgs;
      console.log(
        `  🔧 调用 ${tc.function.name}(${args.a} ${args.op} ${args.b})`,
      );
      let toolResult: string;
      try {
        toolResult = String(calculator(args));
        console.log(`  ✅ 结果: ${toolResult}`);
      } catch (err) {
        toolResult = `Error: ${(err as Error).message}`;
        console.log(`  ❌ 工具报错: ${toolResult}`);
      }
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: toolResult,
      });
    }
    // 4️⃣ 重试：循环顶部继续 → LLM 看到新的工具结果后再决定下一步
  }

  throw new Error(`Agent 超过最大轮数 ${MAX_TURNS}，强制终止。`);
}

async function main() {
  console.log("📝 问题：", question);
  console.log("✅ 标准答案：", (((25 + 17) * 3) - 8) / 2);

  const finalAnswer = await runAgent(question);

  console.log("\n════════════════════════");
  console.log("🎯 Agent 最终回答：", finalAnswer);
  console.log("════════════════════════");
  console.log(
    "\n💡 复习 5 步骤映射：",
  );
  console.log("   推理 = llm.chat.completions.create");
  console.log("   反思 = if (!msg.tool_calls) return");
  console.log("   行动 = calculator(args)");
  console.log("   观察 = messages.push({ role: 'tool', ... })");
  console.log("   重试 = for 循环回到下一轮");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
