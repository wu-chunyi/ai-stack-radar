# AI Stack Radar

> 一个自用的 AI 工具雷达站 —— 同时也是「AI 原生前端工作流」的学习项目。
>
> 通过构建这个项目，亲手走通 **设计稿 → 代码 → 还原度验证 → 自动测试** 的完整闭环。

---

## 目标四件套

| 阶段 | 工具 | 学到的原理 |
| --- | --- | --- |
| ① 设计稿 | **Figma Make** | LLM → Figma 图层/Auto Layout/Variables 的映射 |
| ② 代码生成 | **v0.dev** + 读 `screenshot-to-code` 源码 | VLM 截图 → React 的 prompt 链 |
| ③ 还原度验证 | **Chromatic** (Storybook) | 视觉回归 baseline 与 PR diff 流 |
| ④ 自动测试 | **Playwright MCP** + Claude | MCP 协议 + Agent loop 五步 |

---

## 技术栈

- **框架**：Next.js 16 (App Router) + React 19
- **样式**：Tailwind v4 + shadcn/ui (base-nova preset)
- **组件文档**：Storybook 10（含 `@chromatic-com/storybook` + `addon-mcp` + `addon-a11y`）
- **测试**：Playwright 1.60（E2E） + Vitest（单测/组件）
- **包管理**：pnpm 10
- **Node**：20.20.1

---

## 快速开始

```bash
pnpm install            # 安装依赖
pnpm dev                # Next.js 开发服务器  → http://localhost:3000
pnpm storybook          # Storybook            → http://localhost:6006
pnpm test:e2e           # 跑 Playwright E2E
pnpm test:e2e:ui        # Playwright UI 模式（推荐调试用）
pnpm build              # 生产构建
pnpm build-storybook    # 构建 Storybook 静态站点
```

---

## 目录结构

```
ai-stack-radar/
├── .github/workflows/
│   └── playwright.yml        # Playwright E2E CI（自动生成）
├── .storybook/               # Storybook 配置
├── src/
│   ├── app/                  # Next.js App Router 页面
│   ├── components/ui/        # shadcn 组件（按需添加）
│   ├── lib/                  # 工具函数
│   └── stories/              # Storybook 示例（可删）
├── tests/                    # Playwright E2E
├── components.json           # shadcn 配置
├── playwright.config.ts      # Playwright 配置
├── vitest.config.ts          # Vitest 配置
└── ROADMAP.md                # 30 个具体 issue ← 看这里
```

---

## 学习路线

**第一次进来，先按这个顺序读：**

1. [`docs/README.md`](./docs/README.md) — 文档索引（2 分钟）
2. [`docs/01-vision.md`](./docs/01-vision.md) — 为什么做这个项目，为什么选这四个工具
3. [`docs/02-architecture.md`](./docs/02-architecture.md) — 产品功能 + 技术栈选型
4. [`docs/03-learning-path.md`](./docs/03-learning-path.md) — 四阶段详解 + 联动闭环
5. [`ROADMAP.md`](./ROADMAP.md) — 30 个具体 issue，开始动手

总周期约 4 周：

- **Week 1**：Phase 1（Figma Make）+ Phase 2 上半
- **Week 2**：Phase 2 下半（读 screenshot-to-code 源码）+ Phase 3 准备
- **Week 3**：Phase 3（Chromatic）+ Phase 4（Playwright MCP）
- **Week 4**：真实使用 + 写复盘博客
