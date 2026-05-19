# Agent 工具机制 · LLM 是大脑，工具是手脚，代码是神经系统

> 核心问题：LLM 自己不能读文件、不能跑命令、不能写文件。它唯一能做的就是**输出文本**。
> "工具调用" = LLM 输出一段 JSON 说"我想调某个工具" → 我们的代码真的去执行 → 把结果喂回给 LLM。

---

## 一轮 tool-use 的完整流程（以 L6 修 bug 为例）

```
我们的代码                        LLM（DeepSeek）
    │                                  │
    │── messages 发给 LLM ───────────→ │
    │                                  │ 分析 messages
    │                                  │ 输出 JSON:
    │                                  │ { tool_calls: [{
    │                                  │     name: "run_command",
    │  ←── tool_calls JSON ───────────│     arguments: '{"command":"npx tsx src/buggy.ts"}'
    │                                  │ }] }
    │                                  │
    │ 解析 JSON                        │              ← LLM 只是"说"想跑，自己跑不了
    │ 真的执行 execSync(...)           │              ← 执行是我们的代码做的
    │ 拿到结果: "TypeError..."         │
    │ 塞进 messages                    │
    │                                  │
    │── messages（含结果）发给 LLM ──→ │
    │                                  │ 看到 TypeError → 决定下一步
    │                                  │ ...（循环继续）
```

---

## 职责分工表

```
┌──────────────┬────────────────────────────────────┐
│     LLM      │           我们的代码                │
├──────────────┼────────────────────────────────────┤
│ 决定调哪个工具 │ 真的去执行那个工具                  │
│ 决定传什么参数 │ 解析 JSON 取出参数                  │
│ 看工具结果    │ 把结果塞回 messages                 │
│ 决定下一步    │ 循环控制（MAX_TURNS、错误处理）      │
│ 决定何时停    │ 检测 !tool_calls 退出循环           │
│              │                                    │
│ 不能读文件 ❌ │ readFileSync ✅                     │
│ 不能跑命令 ❌ │ execSync ✅                         │
│ 不能写文件 ❌ │ writeFileSync ✅                    │
└──────────────┴────────────────────────────────────┘
```

---

## 对应到代码里的一行

```ts
resultStr = JSON.stringify(dispatch(tc.function.name, args));
//                         ↑ 我们的代码执行   ↑ LLM 决定的
```

- `tc.function.name` 和 `args`：LLM 输出的（它说"我想调 run_command，参数是 xxx"）
- `dispatch()`：我们的代码执行的（真的去跑命令 / 读文件 / 写文件）
- `resultStr`：工具的真实输出，我们的代码把它塞回 messages 给 LLM 看

---

## 一句话总结

**LLM 是"大脑"，工具是"手脚"，我们的 while 循环是"神经系统"把两者连起来。**

LLM 自己没有手——它只能说"我想做 X"。是我们的代码真的去做了 X，然后把结果告诉它"X 的结果是 Y"，它再决定下一步。这个来回就是 agent loop 的全部。
