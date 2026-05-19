# ROADMAP · AI Stack Radar

> 30 个具体 issue，按四阶段拆解，每个粒度 1–4 小时。
>
> 完成一个就勾一个，配合 GitHub Issues 使用更佳。

---

## Phase 1 · Figma Make → 设计稿（约 3 天）

> 目标：拿到一份能交付给「自己」的 Figma 文件，含完整 Design Token 体系。

- [ ] **#1** 在 Figma 新建 file `AI Stack Radar`，建一个 Page 叫 `01_Tokens`
- [ ] **#2** 用 Figma Variables 建一套 Token：颜色（primary/neutral/danger 各 12 阶）、间距（4/8/12/16/24/32/48）、字号（12/14/16/20/24/32）、圆角（4/8/12/full）
- [ ] **#3** 用 Figma Make prompt 生成首页（工具卡片网格 + 顶部筛选栏 + 侧栏分类树）
- [ ] **#4** 用 Figma Make 生成工具详情页（标题 + 描述 + 标签 + 优缺点 + 替代品推荐）
- [ ] **#5** 用 Figma Make 生成对比页（最多 4 个工具横向对比表）
- [ ] **#6** 把生成的 3 个页面重构为 Auto Layout + Components，所有色值用 Token 替换
- [ ] **#7** **复盘笔记**：在 Notion/Obsidian 写一篇 *Figma Make 适合做什么 / 翻车在哪*

---

## Phase 2 · v0.dev → React 组件（约 5 天）

> 目标：`src/components/` 下产出 20+ 个可用的原子组件，所有 Token 与 Phase 1 对齐。

- [ ] **#8** 把 Phase 1 Figma Token 迁移到 `src/app/globals.css` 的 `@theme` 块
- [ ] **#9** 用 v0.dev 生成 `ToolCard`（截图 ToolCard 区域喂入）
- [ ] **#10** 用 v0.dev 生成 `FilterBar`（多选标签 + 排序下拉）
- [ ] **#11** 用 v0.dev 生成 `CategoryTree`（侧栏分类树，可折叠）
- [ ] **#12** 用 v0.dev 生成 `CompareTable`（横向对比表，sticky 表头）
- [ ] **#13** 用 v0.dev 生成 `RatingBar`（5 星评分 + 维度雷达图）
- [ ] **#14** 用 v0.dev 生成 `DetailHeader`（详情页头部：图标 + 标题 + 标签 + CTA）
- [ ] **#15** 用 v0.dev 生成 `AlternativeList`（替代品横向滚动列表）
- [ ] **#16** **原理学习**：clone `screenshot-to-code` 仓库，跑通本地 demo
- [ ] **#17** **原理学习**：读 `screenshot-to-code` 的 prompt 模板与迭代逻辑，输出一份脑图
- [ ] **#18** **复盘笔记**：对比 v0.dev 与 `screenshot-to-code` 的 prompt 策略差异

---

## Phase 3 · Storybook + Chromatic → 还原度验证（约 3 天）

> 目标：CI 上每个 PR 自动出视觉 diff 评论。

- [ ] **#19** 删除 `src/stories/` 下的示例 stories
- [ ] **#20** 为 Phase 2 的每个组件写 Story（CSF3，3–5 个 variant + 1 个 hover/focus state）
- [ ] **#21** 启用 `addon-a11y`，修复所有 organism 级别组件的 a11y 警告
- [ ] **#22** 注册 Chromatic 账号，拿到 project token，写入 GitHub Secret `CHROMATIC_PROJECT_TOKEN`
- [ ] **#23** 添加 `.github/workflows/chromatic.yml`，PR 触发
- [ ] **#24** 跑第一次 baseline，accept all
- [ ] **#25** **联动实验**：把 Phase 1 Figma 截图作为参考图，反向对比 v0 输出的还原度差异（人工评分 1-5）
- [ ] **#26** **故意制造偏差实验**：改一行 padding / 换字体 / 改 dark 配色，观察 Chromatic 报 diff 的粒度

---

## Phase 4 · Playwright MCP → 自动测试 + 修复（约 4 天）

> 目标：让 Claude 自主跑 E2E、失败自修复，至少完成 3 轮 loop。

- [ ] **#27** 写 5 条核心 E2E：搜索 / 筛选 / 详情 / 加对比 / 导出对比
- [ ] **#28** 在 Claude Code（或 Augment）配置 Playwright MCP server，本地跑通
- [ ] **#29** **Agent loop 实验**：故意制造 3 个 bug（按钮失效 / 路由错误 / 状态丢失），让 Claude 通过 MCP 自主发现并修复
- [ ] **#30** **复盘**：写一篇博客《我用四件套构建了一个 AI 工具雷达 —— 一个前端工程师的 AI 原生工作流实验》

---

## 闭环验证（完成后做）

走通这条链路才算真正"学会"：

```
Figma Make 出设计稿
   ↓
v0.dev 把截图转成代码
   ↓
Storybook 把组件孤立展示
   ↓
Chromatic 用 Figma 截图当 baseline 验证还原度
   ↓
Playwright MCP 让 Claude 跑完整业务流
   ↓
失败时 Claude 自动改代码 → 重新触发 Chromatic → 闭环
```

---

## 进度追踪

- 开始日期：____
- 当前 Phase：____
- 已完成 issue：__ / 30
