/**
 * 同样的题 5+5*5，把 2 元 calculator 换成 eval_expression。
 * 看 agent 调几次工具、还需不需要 LLM 自己懂运算符优先级。
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";

// 「好」工具：直接接收完整表达式，由确定性代码（不是 LLM）来解析优先级
function evalExpr(expr: string): number {
  // 只允许数字、空格、四则、括号、小数点。安全白名单。
  if (!/^[\d+\-*/(). ]+$/.test(expr)) throw new Error("非法表达式");
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expr})`)() as number;
}

const evalExprSchema = {
  type: "function" as const,
  function: {
    name: "eval_expression",
    description: "对一个标准数学表达式求值，自动处理运算符优先级和括号。",
    parameters: {
      type: "object",
      properties: { expr: { type: "string", description: "如 '5 + 5 * 5' 或 '(1+2)*3'" } },
      required: ["expr"],
    },
  },
};

const question = "请计算 5 + 5 * 5。";

async function main() {
  console.log("📝 问题：", question, "（标准答案 30）");
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: "你是数学助手。只能用 eval_expression 工具，禁止心算。" },
    { role: "user", content: question },
  ];
  for (let turn = 1; turn <= 5; turn++) {
    console.log(`\n── 轮 ${turn} ──`);
    const res = await llm.chat.completions.create({ model: MODEL, messages, tools: [evalExprSchema] });
    const msg = res.choices[0]!.message;
    messages.push(msg);
    if (!msg.tool_calls?.length) { console.log("🎯 最终：", msg.content); return; }
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const { expr } = JSON.parse(tc.function.arguments) as { expr: string };
      const result = evalExpr(expr);
      console.log(`  🔧 eval_expression("${expr}") = ${result}`);
      messages.push({ role: "tool", tool_call_id: tc.id, content: String(result) });
    }
  }
}
main();
