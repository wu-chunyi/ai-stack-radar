/**
 * 用户提出的尖锐问题：5 + 5 * 5
 *
 * 标准答案 30（先算 5*5=25, 再 5+25）
 * 错误拆法答案 50（先算 5+5=10, 再 10*5）
 *
 * 用同样的 agent loop + 同样的 2 元 calculator 跑一次，看 LLM 拆对没。
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { calculator, calculatorSchema, type CalcArgs } from "./tools/calculator.js";

const question = "请计算 5 + 5 * 5，给出最终结果。";

async function main() {
  console.log("📝 问题：", question, "（标准答案 30）");
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: "你是数学助手。只能用 calculator 工具，每次只能算两数。" },
    { role: "user", content: question },
  ];

  for (let turn = 1; turn <= 10; turn++) {
    console.log(`\n── 轮 ${turn} ──`);
    const res = await llm.chat.completions.create({ model: MODEL, messages, tools: [calculatorSchema] });
    const msg = res.choices[0]!.message;
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      console.log("🎯 最终：", msg.content);
      return;
    }
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments) as CalcArgs;
      const result = calculator(args);
      console.log(`  🔧 ${args.a} ${args.op} ${args.b} = ${result}`);
      messages.push({ role: "tool", tool_call_id: tc.id, content: String(result) });
    }
  }
}
main();
