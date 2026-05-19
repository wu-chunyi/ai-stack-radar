# 03 · 四阶段学习路径

> 每阶段三件事：做什么、学到的原理、产物。
>
> 配合 [`../ROADMAP.md`](../ROADMAP.md) 30 个 issue 一起看。

---

## Phase 1 · Figma Make → 设计稿（约 3 天）

**做什么：**
1. 在 Figma 里用 Variables 建一套 Design Token（颜色 / 间距 / 字号 / 圆角）
2. 用 Figma Make 通过 prompt 生成首页、详情页、对比页三个核心界面
3. 手工把生成的图层重构为 Auto Layout + Components

**学到的原理：**
- LLM 怎么把自然语言映射到 Figma 的图层结构与 Auto Layout 约束
- Design Token / Variables 与 CSS Custom Property 的一一对应（这是 Phase 2 高还原度的前提）
- Figma Make 在哪些场景翻车（复杂表格 / 自定义滚动 / 动态高度）—— 直接对应你以后 prompt 工程的边界感

**产物：** 一份能交付给「自己」的 Figma 文件，含完整 Token 体系。

---

## Phase 2 · v0.dev → React 组件（约 5 天）

**做什么：**
1. 把 Figma 截图丢给 v0.dev，逐个生成原子组件（先 ToolCard，再 FilterBar，再 CompareTable）
2. 把 v0 的 Tailwind token 替换为 Phase 1 的 Design Token 变量
3. 用 v0 的「迭代修改」能力做受控实验：故意改 prompt 看输出变化
4. **关键学习动作**：周末花半天读 `screenshot-to-code` 源码，理解 v0 背后的 prompt 链

**学到的原理：**
- VLM 截图 → DOM 的转换链路（系统 prompt、few-shot 示例、迭代修正）
- 为什么 v0 输出 shadcn 而不是 MUI（训练数据 + 组件可复制性）
- 哪些组件 AI 做得好（静态展示类），哪些做得差（强交互、a11y 重的）

**产物：** `src/components/domain/` 下 8+ 个真实可用的组件。

---

## Phase 3 · Storybook + Chromatic → 还原度验证（约 3 天）

**做什么：**
1. 给所有原子组件写 Story（CSF3 格式，每个 3–5 个 variant）
2. 接入 Chromatic CI，跑第一次 baseline
3. **故意制造 3 种偏移**：改一行 padding / 换字体 / 改 dark 配色，观察 Chromatic 如何报 diff
4. 在一个 PR 里尝试 `Accept Changes` 流程，理解 baseline 的版本管理

**学到的原理：**
- 视觉回归的底层：像素级 diff vs 结构 diff vs AI-based diff
- 为什么 Storybook 是前端组件的「单元测试」单位
- 与设计稿对齐的「卷尺」：把 Figma 截图作为 baseline 反向验证 v0 输出还原度（**这是 Phase 2 ↔ Phase 3 的联动点**）

**产物：** PR 上自动出现视觉 diff 评论，CI 流程跑通。

---

## Phase 4 · Playwright MCP → 自动测试 + 修复（约 4 天）

**做什么：**
1. 写 5 条关键路径 E2E：搜索工具 / 加筛选 / 查看详情 / 加入对比 / 导出对比结果
2. 在 Claude Code（或 Augment）里挂载 Playwright MCP server
3. **核心练习**：让 Claude 自主跑测试 → 失败时自己截图 → 定位代码 → 提修复 PR。重复 3 轮
4. 把 E2E 接到 GitHub Actions，与 Chromatic 并行跑

**学到的原理：**
- MCP 协议的本质：把工具能力以 JSON-RPC 暴露给 LLM，**协议层学一次终身受用**
- Agent loop 的核心 5 步：观察 → 推理 → 行动 → 反思 → 重试
- LLM 操控浏览器与人写测试的边界（AI 擅长流程发现，人擅长断言设计）

**产物：** 一个能自我修复的测试套件，未来所有工具学习项目都能复用这套 MCP 配置。

---

## 联动闭环（四阶段串起来）

每个阶段单独有价值，但**真正的学习发生在联动点上**：

```
Figma Make 出设计稿
       ↓
v0.dev 把截图转成代码
       ↓
Storybook 把组件孤立展示
       ↓
Chromatic 用 Figma 截图当 baseline → 验证 v0 还原度    ← Phase 2 ↔ 3 联动
       ↓
Playwright MCP 让 Claude 跑完整业务流
       ↓
失败 → Claude 自动改代码 → 触发 Chromatic → 闭环      ← Phase 3 ↔ 4 联动
```

走通这个闭环，你就具备了**「AI 原生前端工程师」的完整工作流**。

---

## 时间表（参考）

| 周 | Phase | 主要产出 |
| --- | --- | --- |
| Week 1 | Phase 1 全 + Phase 2 上半 | Figma 设计稿 + 3 个 v0 组件 |
| Week 2 | Phase 2 下半 + Phase 3 准备 | 全部 8 个组件 + `screenshot-to-code` 阅读笔记 |
| Week 3 | Phase 3 + Phase 4 | Chromatic CI 跑通 + Playwright MCP 配通 |
| Week 4 | 真实使用 + 复盘 | 录入 20+ 真实 AI 工具数据 + 写博客 |

---

## 完成判定

每个 Phase 完成的硬性标准：

- ✅ Phase 1：Figma 文件 share link 能打开，所有色值走 Variables
- ✅ Phase 2：`pnpm dev` 能看到首页 / 详情 / 对比页三个真实页面
- ✅ Phase 3：随便提一个 PR，能在 PR 评论区看到 Chromatic 的 diff 截图
- ✅ Phase 4：故意改坏一行代码，Claude 通过 MCP 能定位并修复（至少 1 次成功 loop）

四个 ✅ 全亮，**项目完成**。
