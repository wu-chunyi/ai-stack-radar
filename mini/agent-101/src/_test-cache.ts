/**
 * 验证：DeepSeek 自带 prompt 缓存到底有没有用？
 *
 * 做法：用同一段长 system prompt + 不同 user 问题，连发 3 次，
 *       打印每次的 usage，重点看 prompt_cache_hit_tokens / prompt_cache_miss_tokens
 *
 * 预期：第 1 次几乎全 miss；第 2、3 次 system prompt 部分会命中缓存。
 */
import { llm, MODEL } from "./llm.js";

// 故意写一段「长」的 system prompt，制造可被缓存的前缀
// （DeepSeek 文档说命中粒度为 64 tokens，所以前缀必须够长）
const LONG_SYSTEM = `
你是一个严谨的代码审查助手。请遵循以下规则：
1. 永远先复述用户的问题，再回答
2. 涉及代码时必须给出文件路径和行号
3. 给出建议时分「必须修复」「建议修复」「可选优化」三档
4. 引用标准时给出来源（如 ECMAScript 规范章节、RFC 编号）
5. 涉及安全问题必须显式标注 [SECURITY]
6. 涉及性能问题必须说明 Big-O 复杂度
7. 当存在多种实现方案时，列出至少 2 种并对比 trade-off
8. 输出格式统一用 markdown
9. 代码块必须标注语言
10. 对不确定的事情直接说「我不确定」，禁止编造
`.repeat(3); // 拼长，确保超过 DeepSeek 的 1024 token 缓存阈值

const questions = [
  "什么是 ECMAScript 模块？",
  "什么是 CommonJS 模块？",
  "ESM 和 CJS 的本质区别是什么？",
];

async function ask(q: string, n: number) {
  console.log(`\n──── 第 ${n} 次调用 ────`);
  console.log("user:", q);
  const res = await llm.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: LONG_SYSTEM },
      { role: "user", content: q },
    ],
    max_tokens: 50, // 答案不重要，只看 usage
  });
  // DeepSeek usage 字段（OpenAI SDK 类型里没有，需 any 取）
  const u = res.usage as unknown as {
    prompt_tokens: number;
    completion_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
  console.log("usage:", {
    prompt_tokens: u.prompt_tokens,
    completion_tokens: u.completion_tokens,
    cache_hit: u.prompt_cache_hit_tokens ?? "N/A",
    cache_miss: u.prompt_cache_miss_tokens ?? "N/A",
  });
}

async function main() {
  for (let i = 0; i < questions.length; i++) {
    await ask(questions[i]!, i + 1);
  }
  console.log(`
💡 解读：
  - prompt_cache_hit_tokens  = 命中缓存的 token，按 ~10% 价格计费
  - prompt_cache_miss_tokens = 未命中，按原价计费
  - 第 1 次基本全 miss；第 2、3 次 system prompt 那部分会变成 hit
  - 这就是 DeepSeek 自带的「免费午餐」：你什么都不用做，只要 system prompt 稳定
`);
}

main().catch(console.error);
