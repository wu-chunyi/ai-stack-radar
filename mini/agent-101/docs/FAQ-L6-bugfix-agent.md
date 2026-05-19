# L6 自动修 Bug Agent · 疑问与解答

> 学习 `src/06-bugfix-agent.ts` 时产生的疑问，逐条记录，方便以后复盘。

---

## Q1: `import OpenAI from "openai"` — 用 DeepSeek 为什么还要 openai 包？

`openai` npm 包不是只能连 OpenAI。它是一个**通用 HTTP 客户端**，只要对方 API 遵守 OpenAI 的请求/响应格式，换一个 `baseURL` 就能连任何厂商：

```ts
// 连 OpenAI
new OpenAI({ baseURL: "https://api.openai.com/v1" })
// 连 DeepSeek
new OpenAI({ baseURL: "https://api.deepseek.com/v1" })
// 连本地 Ollama
new OpenAI({ baseURL: "http://localhost:11434/v1" })
```

DeepSeek **故意**把 API 设计成 OpenAI 兼容（tool_calls 格式、messages 格式全一样），行业里 90% 的厂商都这么做。所以 `openai` 这个包名有误导性，实际上是「行业通用 LLM client」。

---

## Q2: `MAX_TURNS = 20` — 为什么是 20？

**没有科学依据，是工程估算**：

```
每个 bug 最坏情况 4 轮（跑→读→改→验证）
× 3 个 bug = 12 轮
+ 初始运行 + 最终总结 = 14 轮
+ 余量 → 20
```

实际只用了 5 轮（LLM 一次修了 3 个 bug）。

设计原则：
- 太小 → 复杂任务被截断
- 太大 → LLM 死循环时烧钱
- 生产环境通常 **10–30**，根据任务复杂度调

**可以改成任何数字**，不同 Level 用不同值（L3=10, L4=20, L5=15）只是毛估。

---

## Q3: `for (let turn = 1; turn <= MAX_TURNS; turn++)` — 每轮干什么？为什么用 for？

### 每轮做的事

```
┌─ 1. 把 messages 发给 LLM（一次 API 请求）
├─ 2. LLM 返回有 tool_calls 吗？
│      ├─ 没有 → return（任务完成）
│      └─ 有 → 跑工具，结果 push 回 messages → 进入下一轮
└─ 3. turn 到 MAX_TURNS 还没 return → 抛异常
```

### 为什么用 for 不用 while(true)

两种写法等价。选 for 因为 **MAX_TURNS 直接写在循环条件里**，不可能忘加安全阀。
`while(true)` 需要手动维护计数器和 break，容易遗漏。

---

## Q4: `msg.content.slice(0, 150)` — 150 什么含义？

**纯显示截断，跟 agent 逻辑无关。**

LLM 的思考内容可能几百上千字，全打印会刷爆终端。`slice(0, 150)` 只是取前 150 字符展示，后面加 `...`。

完整的 `msg.content` 已经在 `messages.push(msg)` 被完整保留，LLM 下一轮能看到全部。

**150 可以改成 50、200、500，无所谓。纯视觉体验。**

---

## Q5: `!msg.tool_calls?.length` 判断完成 — "完成" 由 LLM 决定？

**是的。这是 agent 设计中最核心的真相。**

```ts
if (!msg.tool_calls?.length) {
  return msg.content;  // LLM 不再请求工具 = 我们认为任务完成
}
```

你的代码没有「检查 buggy.ts 是否真的 PASS」的逻辑——那是 LLM 通过看 `run_command` 输出自己判断的。

| 场景 | 后果 |
|---|---|
| LLM 认真验证了 | ✅ 看到 PASS 才停 |
| LLM 偷懒直接停 | ❌ 可能没改好就宣称完成 |
| LLM 修不好反复循环 | MAX_TURNS 兜底 |

**优化方向**：
- system prompt 里写 "必须运行验证通过才能结束"
- 代码层加硬性检查：`if (output.includes("PASS")) return`
- 生产系统两层都加

---

## Q6: 两个 slice + 并行执行 — 逐行拆解

### 并行执行是什么意思

```ts
// 串行（一个跑完再跑下一个）
for (const tc of tool_calls) { await run(tc); }

// 并行（全部同时启动，等最慢的）
await Promise.all(tool_calls.map(async (tc) => run(tc)));
```

当 LLM 一次返回多个 tool_calls 时（如 L4 的 9 个 grep），并行比串行快 N 倍（N = 工具调用数）。对本地文件工具差别不大，对 HTTP/数据库工具差别巨大。

### 两个 slice 分别是什么

**slice ①**：截断工具**参数**的显示
```ts
const argsStr = JSON.stringify(args).slice(0, 80);
console.log(`  🔧 ${tc.function.name}(${argsStr})`);
```
→ write_file 的 content 可能是整个文件，只取前 80 字符打印。**不影响执行**，完整 args 传给了 dispatch()。

**slice ②**：截断工具**结果**的显示
```ts
const preview = resultStr.length > 300 ? resultStr.slice(0, 300) + "…" : resultStr;
console.log(`  ✅ ${preview}`);
```
→ read_file 返回可能几 KB，只取前 300 字符打印。**不影响逻辑**，完整 resultStr 进了 messages 给 LLM 看。

**总结：两个 slice 都只是 console.log 的显示截断。传给 LLM 的数据是完整的。**

---

## 核心认知小结

1. **openai SDK = 通用 LLM 客户端**，不绑定 OpenAI
2. **MAX_TURNS = 工程估算**，不是精确计算
3. **for 循环 = while + 安全阀**，每轮一次 LLM 请求
4. **slice 都是显示截断**，不影响 agent 逻辑
5. **"完成" = LLM 不再请求工具**，你的代码信任 LLM 的判断
6. **Promise.all = 并行跑多个工具**，对慢工具加速明显
