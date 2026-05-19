# 01 · 项目愿景与四件套选择

> 解决两个核心问题：
> 1. 为什么要做一个练手项目，而不是各装一个工具单独学？
> 2. 在每个赛道里，为什么是 **Figma Make / v0.dev / Chromatic / Playwright MCP**？

---

## 1. 项目背景：AI 改变前端的四个赛道

2025 年起，AI 已经从「写代码片段」深入到前端工作流的每一环。整理下来，最卷的四个赛道是：

| 赛道 | 代表项目 |
| --- | --- |
| ① PRD / 自然语言 → 设计稿 | Galileo AI、Uizard、Magic Patterns、**Figma Make** |
| ② 设计稿 / Prompt → 前端代码 | **v0.dev**、bolt.new、Lovable、screenshot-to-code、Anima、Locofy、CodeFun、MasterGo、Trae |
| ③ 还原度验证 | Applitools、Percy、**Chromatic**、Argos CI、Meticulous |
| ④ 自动测试 + 自动修复 | Qodo、Meticulous、OpenHands、Devin、**Playwright MCP** |

各装一个孤立工具学，会陷入「看 demo 觉得懂了，真用时手忙脚乱」的陷阱。所以本项目的核心思想是：**用一个真实的小产品，把四个工具串成一条闭环**。

---

## 2. 各赛道的选择理由

### ① 设计稿生成 → **Figma Make**

| 候选 | 不选的原因 |
| --- | --- |
| Galileo AI | 已被 Figma 收购，能力会并入 Figma Make |
| Uizard | 偏低保真原型，产出物离生产级远 |
| Magic Patterns | 跳过设计稿直接给 React，属于第 2 类 |

**选 Figma Make 的理由**：
- 公司里设计师 / PM 协作链路 99% 在 Figma 上，**产出物能直接进现有协作流**
- Figma 官方亲儿子，Variables / Auto Layout / 插件生态全打通
- 学完能在「设计稿评审、还原度对齐、Token 映射」环节和设计师同频

**前端工程师该学的重点**：Auto Layout ↔ Flex/Grid、Variables ↔ Design Token —— 这两点决定 Phase 2 还原度上限。

---

### ② 代码生成 → **v0.dev**（生产用）+ **screenshot-to-code**（原理学习）

| 候选 | 不选的原因 |
| --- | --- |
| bolt.new / Lovable | 偏 0→1 全栈 demo，难塞进现有项目代码库 |
| Anima / Locofy | 还原度高但耦合严重，二次维护性差 |
| 国内 CodeFun / MasterGo / Trae | 国际化栈支持和迭代速度暂时落后 |

**选 v0.dev 的理由**：
- 输出 **React + Tailwind + shadcn/ui** —— 国际前端事实标准，**可直接复制粘贴到项目**
- shadcn 是源码复制式，不是黑盒依赖，符合工程师对可控性的要求
- 增量迭代体验最好（「再加一个筛选项」「换成 Dialog」处理得最准）

**补一个 `screenshot-to-code` 学原理**：70k★ 开源，一个下午能读完，能彻底搞清楚 VLM → DOM 整条 prompt 链。读完你就能判断 v0 什么时候会翻车、怎么写 prompt 更稳。

---

### ③ 还原度验证 → **Chromatic**

| 候选 | 不选的原因 |
| --- | --- |
| Applitools / Percy | 偏 QA 工具，对前端栈不亲 |
| Meticulous AI | 核心是生成测试，不是还原度对比 |
| Argos CI | 开源但生态、文档、CI 集成弱一档 |
| Design2Code / DesignBench | 学术 benchmark，不是工程工具 |

**选 Chromatic 的理由**：
- 和 **Storybook 同一家公司**，零配置接入
- 视觉 diff + 交互测试 + a11y 三合一
- PR 上自动出对比图评论，**Code Review 流程能无缝集成** —— 这是真实开发最关键的一点

---

### ④ 自动测试 + 修复 → **Playwright MCP**

| 候选 | 不选的原因 |
| --- | --- |
| Qodo | 单测强，但「自动修复」局限在函数级，覆盖面窄 |
| Meticulous | 核心是录制 E2E，不是 Agent 自修复 |
| OpenHands / Devin | 通用 Agent，浏览器/测试只是能力之一，ROI 分散 |

**选 Playwright MCP 的理由**：
- 微软官方，**MCP 是 2025 事实标准协议** —— 学协议比学某个工具收益高
- Playwright 本身就是前端 E2E 事实标准，**学习沉淀双份**
- 可直接和你已用的 Claude / Augment 打通 → AI 跑测试 → 看截图 → 改代码 → 闭环

---

## 3. 学习目标

完成本项目后，你应该具备：

1. **设计师同频能力** —— 看懂 Figma Variables / Auto Layout，能用 Token 与设计师对齐
2. **AI 编码工程化能力** —— 知道 v0.dev 该信什么不该信什么，能写高 ROI 的 prompt
3. **还原度量化能力** —— 把"像不像"从感觉变成 CI 上的红绿灯
4. **AI 测试 Agent 能力** —— 配置 MCP server，让 LLM 自主跑测试 + 修代码

这四样合起来 = 2026 年市场稀缺的「**AI 原生前端工程师**」核心技能栈。

---

## 4. 为什么是「AI Stack Radar」这个产品

可以做 todo list、博客、电商 demo，为什么偏偏是「追踪 AI 工具」？

- **元学习闭环**：用 AI 工具构建一个「记录 AI 工具」的产品，在用工具的同时形成评测判断，写进产品里。
- **天然覆盖四类能力**：卡片列表 / 筛选 / 详情 / 对比页 → 设计稿丰富；大量原子组件 → 组件库自然涌现；多步骤用户流 → E2E 有得跑。
- **没有后端复杂度**：MVP 用本地 JSON 或 SQLite 就够，不被后端拖住学习节奏。
- **能长期维护**：项目对你有用，做完不会丢，未来还能叠加新工具继续学（比如自己写一个 MCP server）。

具体的产品功能与技术架构 → [`02-architecture.md`](./02-architecture.md)。
