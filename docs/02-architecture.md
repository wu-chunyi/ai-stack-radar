# 02 · 项目设计与技术栈

> 回答：产品长什么样？为什么选这套技术栈？

---

## 1. 产品功能

**MVP 范围（Phase 1–4 内必须完成）：**

| 页面 | 功能 | 覆盖的组件类型 |
| --- | --- | --- |
| 首页 | 工具卡片网格 + 顶部筛选栏 + 侧栏分类树 | Card、Tag、FilterBar、Tree、SearchInput |
| 工具详情页 | 图标 + 描述 + 评分 + 优缺点 + 替代品 | Header、RatingBar、Tabs、CompareTable |
| 对比页 | 最多 4 个工具横向对比 | Table（sticky 表头）、Cell、Diff |
| 管理页（极简） | 新增 / 编辑工具记录 | Form、Input、Select、Textarea |

**未来扩展（不在本次范围）：**
- 全文搜索（接 Algolia 或 SQLite FTS5）
- 用户登录 + 个人收藏
- AI 推荐：根据你已收藏的工具推荐替代品
- 自己写一个 MCP server 暴露查询能力给 Claude

---

## 2. 数据模型（最小）

```ts
type Tool = {
  id: string;
  name: string;
  slug: string;
  category: 'design' | 'code-gen' | 'visual-regression' | 'testing' | 'other';
  description: string;
  pros: string[];
  cons: string[];
  pricing: 'free' | 'freemium' | 'paid';
  rating: {
    ease: number;       // 易用性 1-5
    output: number;     // 产出质量 1-5
    ecosystem: number;  // 生态 1-5
  };
  alternatives: string[]; // Tool.slug[]
  url: string;
  createdAt: string;
};
```

MVP 用本地 JSON（`src/data/tools.json`）+ Next.js Server Component 直接读，不接数据库。

---

## 3. 技术栈选型

| 层 | 选型 | 选它的理由 |
| --- | --- | --- |
| 框架 | **Next.js 16** (App Router) | 与你公司项目 React 栈一致；Server Component 减少 client bundle |
| 语言 | **TypeScript 5.9** | 行业默认 |
| 样式 | **Tailwind v4** | v0.dev 原生输出栈；Token 直接走 CSS Variables |
| 组件库 | **shadcn/ui** (base-nova preset) | 源码复制式，可控；v0.dev 默认产出栈 |
| 图标 | **lucide-react** | shadcn 默认配套 |
| 文档 | **Storybook 10** | Chromatic 前置条件；前端组件单元测试 |
| 视觉回归 | **Chromatic** | Storybook 同公司，零配置 |
| 单测/组件测试 | **Vitest 4** + `@storybook/addon-vitest` | Storybook 10 默认 |
| E2E | **Playwright 1.60** | 事实标准 + MCP 生态 |
| MCP | **Playwright MCP** + Storybook MCP addon | AI 操控前端的标准协议 |
| 包管理 | **pnpm 10** | 速度快，monorepo 友好 |
| 部署 | **Vercel** | Next.js 同公司，5 分钟上线 |

---

## 4. 目录结构

```
ai-stack-radar/
├── .github/workflows/
│   ├── playwright.yml           # E2E CI（已自动生成）
│   └── chromatic.yml            # 视觉回归 CI（Phase 3 时添加）
├── .storybook/                  # Storybook 配置
├── docs/                        # ← 本目录：项目构思文档
├── public/                      # 静态资源
├── src/
│   ├── app/                     # Next.js 路由
│   │   ├── page.tsx             # 首页
│   │   ├── tools/[slug]/        # 详情页
│   │   ├── compare/             # 对比页
│   │   └── admin/               # 管理页
│   ├── components/
│   │   ├── ui/                  # shadcn 原子组件
│   │   └── domain/              # 业务组件（ToolCard、CompareTable 等）
│   ├── data/
│   │   └── tools.json           # 数据源
│   ├── lib/
│   │   ├── utils.ts             # cn() 等工具
│   │   └── tools.ts             # 数据读写 + 类型
│   └── stories/                 # Storybook stories（Phase 3 整理）
├── tests/                       # Playwright E2E
├── components.json              # shadcn 配置
├── playwright.config.ts
├── vitest.config.ts
└── ROADMAP.md                   # 30 issue 行动清单
```

---

## 5. 关键约束

- **Token 单一来源**：所有颜色/间距/字号必须走 Tailwind v4 `@theme` 块定义的 CSS Variables。这是 Phase 1 → Phase 2 → Phase 3 联动的基础。
- **组件双产物**：每个 `components/domain/*` 必须配一个 `*.stories.tsx`，否则 Chromatic 测不到。
- **页面级 E2E**：每条核心用户路径必须有 1 条 Playwright spec，否则 Phase 4 的 Agent loop 无从入手。

---

下一步 → [`03-learning-path.md`](./03-learning-path.md) 看四阶段怎么走。
