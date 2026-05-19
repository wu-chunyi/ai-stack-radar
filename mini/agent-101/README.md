# Agent 101 · 从零理解 Agent Loop

> 目标：用 100 行级别的代码，让你**亲眼看到** agent 的 5 个步骤如何在一个 `while` 循环里发生。

---

## 一个 Agent = 一个循环

普通调用 LLM：

```
你   → "今天北京天气怎么样？"
LLM  → "对不起，我无法获取实时信息。"
[结束]
```

Agent：

```
你   → "今天北京天气怎么样？"
LLM  → [我需要查] → tool_call: get_weather("北京")
Tool → "晴, 22°C"
LLM  → [我已经知道了] → "北京今天晴，22°C"
[结束]
```

**区别只有一处**：LLM 的输出不仅可以是文字，**还可以是「工具调用请求」**。Runtime 跑完工具把结果塞回对话，循环继续，直到 LLM 不再请求工具。

---

## 5 个步骤 vs 实际代码

理论上 agent loop 有 5 步：**观察 → 推理 → 行动 → 反思 → 重试**

实际代码就是这 12 行：

```ts
const messages = [{ role: "user", content: userInput }]

while (true) {
  const reply = await llm.chat(messages, tools)   // 推理
  messages.push(reply)                            //
  if (!reply.tool_calls) {
    return reply.content                          // 反思: LLM 决定不再调工具 = 完成
  }
  for (const tc of reply.tool_calls) {
    const result = runTool(tc.name, tc.args)      // 行动
    messages.push({ role: "tool",                 // 观察
                    tool_call_id: tc.id,
                    content: result })
  }
  // 没 return 就自动进入下一轮 = 重试
}
```

**没有别的魔法。** 你看到的所有 "AI Agent 框架"（LangGraph、AutoGen、CrewAI…）本质都是在这个循环上加花样：多 agent、记忆、规划器、工具路由…… 但内核都是这个 while。

---

## 三个例子，逐层加深

| 文件 | 内容 | 是 agent 吗？ | 你会学到 |
|---|---|---|---|
| `src/01-bare-llm.ts` | 只调 LLM，无工具 | ❌ | LLM 算数会错 / 会胡说 → 为什么需要工具 |
| `src/02-tool-call.ts` | LLM + 1 工具，**手写 1 轮** | ❌ 还不是 | tool_call 的请求/响应格式长什么样 |
| `src/03-agent-loop.ts` | 套上 `while` 循环 | ✅ 是 | 真·agent，连续调多次工具直到完成 |

---

## 跑起来

```bash
cd mini/agent-101
pnpm install
cp .env.example .env
# 编辑 .env，填入你的 DEEPSEEK_API_KEY

pnpm run 01   # 看 LLM 算数翻车
pnpm run 02   # 看一轮 tool-use 长什么样
pnpm run 03   # 看 agent 自动连调多次工具
```

---

## 学完这一节，你能回答

1. Agent 和"LLM + prompt"的本质区别是什么？→ **是否有循环 + 是否能调工具**
2. 为什么 MCP 重要？→ **MCP 是「工具暴露给 LLM」的标准协议**，本节我们手写工具，下一节会换成 MCP 工具
3. 为什么 v0.dev / Figma Make 不是 agent？→ **它们是单向 prompt chain，没有"LLM 看到工具结果后再决定下一步"的循环**

---

## 下一节预告（L4–L5）

- L4 · ReAct 模式：让 LLM 把"我为什么要调这个工具"的思考过程**显式输出**
- L5 · 多工具 + 终止条件 + 反思：当工具调用出错时，agent 怎么恢复
