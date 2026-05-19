/**
 * L1 · 裸 LLM 调用（这不是 agent）
 *
 * 这一节只做一件事：直接问 LLM 一道算术题。
 * 你会发现两个问题之一：
 *   1) LLM 算错了（小概率，但确实会发生）
 *   2) LLM 算对了，但你**无法验证**它是真算的还是猜的
 *
 * 这就是为什么我们需要工具：把「确定性的能力」从 LLM 手里抠出来交给代码。
 */

import { llm, MODEL } from "./llm.js";

const question = "请计算：(((25 + 17) * 3) - 8) / 2 等于多少？只输出最终数字。";

async function main() {
  console.log("📝 问题：", question);
  console.log("⏳ 直接问 LLM（不给任何工具）...\n");

  const res = await llm.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: question }],
  });

  const answer = res.choices[0]?.message.content?.trim();
  console.log("🤖 LLM 回答：", answer);
  console.log("✅ 正确答案：", (((25 + 17) * 3) - 8) / 2);
  console.log(
    "\n💡 重点：即使这次答对了，你也不知道 LLM 是「真算了」还是「猜中了」。",
  );
  console.log("   下一步（02-tool-call）：把计算这件事交给一个工具。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
