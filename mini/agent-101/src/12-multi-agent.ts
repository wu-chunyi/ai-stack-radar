/**
 * L12 · 多 Agent 系统 · Supervisor + Researcher + Critic + Synthesizer
 *
 * 三种 Agent，三种系统 prompt，同一个 while 循环：
 *
 *   Researcher  → 挖掘工具优势（有工具调用权）
 *   Critic      → 寻找工具缺点（有工具调用权）
 *      ↑ 两个并行跑（Promise.all）
 *   Synthesizer → 综合两方给出建议（只看文字，无工具）
 *
 * 核心学习点：
 *   1. 同一个 while 循环，换系统 prompt = 换 Agent 角色
 *   2. Promise.all 让两个 Agent 并行 → 省时间
 *   3. 结果通过 messages 传递给下一个 Agent
 *   4. 这就是 CrewAI / AutoGen 的内核
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { llm, MODEL } from "./llm.js";
import { agentTools, runAgentTool } from "./tools/agent-toolkit.js";

// ===== 通用 Agent Loop（跟 L3-L6 完全一样的 while 循环）=====

async function runAgent(config: {
  name: string;
  systemPrompt: string;
  userMessage: string;
  tools?: typeof agentTools.researcher;
  maxTurns?: number;
}): Promise<string> {
  const { name, systemPrompt, userMessage, tools = [], maxTurns = 8 } = config;
  console.log(`\n  [${name}] 开始工作...`);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  for (let turn = 1; turn <= maxTurns; turn++) {
    const res = await llm.chat.completions.create({
      model: MODEL,
      messages,
      ...(tools.length ? { tools } : {}),
    });
    const msg = res.choices[0]!.message;
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      const preview = (msg.content ?? "").slice(0, 80);
      console.log(`  [${name}] 完成（${turn}轮）: ${preview}...`);
      return msg.content ?? "";
    }

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments) as Record<string, string>;
      console.log(`  [${name}] 🔧 ${tc.function.name}("${Object.values(args)[0]?.slice(0, 30)}")`);
      const result = runAgentTool(tc.function.name, args);
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }
  return "(超时)";
}

// ===== 多 Agent 编排 =====

async function analyzeToolWithMultiAgent(toolName: string): Promise<void> {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`🎯 多 Agent 分析: ${toolName}`);
  console.log(`${"═".repeat(50)}`);

  const question = `请深入分析 AI 工具「${toolName}」`;

  // ── 并行：Researcher + Critic 同时跑 ──────────────────────────────
  console.log("\n⚡ Researcher & Critic 并行启动（Promise.all）");
  const start = Date.now();

  const [researchResult, criticResult] = await Promise.all([
    runAgent({
      name: "Researcher",
      systemPrompt:
        "你是 AI 工具研究专家，专门发现工具的亮点和价值。" +
        "用工具搜索信息，重点挖掘：核心功能、独特优势、适用场景、真实用户收益。" +
        "给出有说服力的正面分析，有数据有细节。",
      userMessage: question,
      tools: agentTools.researcher,
    }),
    runAgent({
      name: "Critic",
      systemPrompt:
        "你是 AI 工具的怀疑论者，专门发现工具的不足和风险。" +
        "用工具搜索信息，重点挖掘：局限性、缺点、竞品对比、高价值场景的缺失、潜在风险。" +
        "给出有理有据的负面分析，帮助用户做出理性决策。",
      userMessage: question,
      tools: agentTools.researcher,
    }),
  ]);

  const parallelMs = Date.now() - start;
  console.log(`\n⏱  两个 Agent 并行耗时: ${parallelMs}ms`);

  // ── 串行：Synthesizer 综合两方结论 ───────────────────────────────
  const synthesisResult = await runAgent({
    name: "Synthesizer",
    systemPrompt:
      "你是决策顾问，专门综合多方观点给出平衡的建议。" +
      "你会收到同一个工具的「正面分析」和「负面分析」，你的任务是：" +
      "1. 归纳核心优缺点  2. 判断适合哪类用户  3. 给出明确的购买/不购买建议  4. 推荐替代品（如果有）。" +
      "输出要简洁有力，适合直接用于决策。",
    userMessage:
      `关于「${toolName}」，请综合以下两份分析：\n\n` +
      `## 正面分析（Researcher）\n${researchResult}\n\n` +
      `## 负面分析（Critic）\n${criticResult}\n\n` +
      `请给出你的综合建议。`,
    // Synthesizer 不需要工具，只需要思考
  });

  // ── 最终输出 ────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(50)}`);
  console.log("📋 最终综合报告");
  console.log(`${"═".repeat(50)}`);
  console.log(synthesisResult);
  console.log(`${"═".repeat(50)}`);
  console.log(`\n💡 多 Agent vs 单 Agent：`);
  console.log(`  单 Agent 让同一个 LLM 分析同一个问题 → 视角单一`);
  console.log(`  多 Agent: Researcher 和 Critic 独立工作 → 相互制衡`);
  console.log(`  并行节省: Researcher + Critic 同时跑，总时间 = max(两者) 而非 sum`);
}

async function main() {
  await analyzeToolWithMultiAgent("Cursor");
}

main().catch((e) => { console.error(e); process.exit(1); });
