# Docs · AI Stack Radar

> 本目录记录这个项目的完整构思过程，是"为什么这样做"的答案集合。
>
> 行动清单见根目录的 [`ROADMAP.md`](../ROADMAP.md)。

---

## 三句话总结

1. **是什么**：一个自用的 AI 工具雷达站 —— 帮你追踪、对比、评测 AI 工具。
2. **为了什么**：本质是「AI 原生前端工作流」的练手项目，通过造一个真实可用的产品，亲手走通 *设计 → 代码 → 还原度 → 自测* 四步闭环。
3. **怎么走通**：每一步选一个最值得学的工具：**Figma Make → v0.dev → Chromatic → Playwright MCP**。

---

## 文档阅读顺序

| 文档 | 回答什么问题 | 何时读 |
| --- | --- | --- |
| [`01-vision.md`](./01-vision.md) | 为什么要做这个项目？为什么选这四个工具？ | **开始之前必读** |
| [`02-architecture.md`](./02-architecture.md) | 项目长什么样？技术栈怎么选？ | 进入 Phase 1 前 |
| [`03-learning-path.md`](./03-learning-path.md) | 四个阶段每一步具体做什么？学到什么原理？ | 每开始一个 Phase 前 |

读完上面三份，再翻 [`../ROADMAP.md`](../ROADMAP.md) 按 issue 一个一个推进。

---

## 学习节奏

预计 4 周，每周 10–15 小时：

- **Week 1** — Phase 1（Figma Make）+ Phase 2 上半（v0.dev 产出原子组件）
- **Week 2** — Phase 2 下半（读 `screenshot-to-code` 源码）+ Phase 3 准备
- **Week 3** — Phase 3（Chromatic 视觉回归）+ Phase 4（Playwright MCP）
- **Week 4** — 真实使用 + 复盘博客

---

## 一句话总结四件套

| 工具 | 一句话 |
| --- | --- |
| Figma Make | Figma 官方的 prompt → 设计稿，跟设计师同频的最快路径 |
| v0.dev | 截图 → React + Tailwind + shadcn，前端日常 ROI 最高 |
| Chromatic | Storybook 同家公司，PR 自动出视觉 diff |
| Playwright MCP | 让 LLM 通过标准协议操控浏览器，AI 原生测试的未来 |
