# 国内主流 Agent 平台 Embedding 模型调研

---

## 各平台用什么模型

| 平台 | 默认 Embedding | 维度 | 来源 |
|---|---|---|---|
| **Coze**（字节） | 内置豆包 embedding | — | 字节自研 |
| **Dify** | 用户自配，推荐 text-embedding-3-large | 3072 | OpenAI |
| **FastGPT** | bge-large-zh-v1.5 / bge-m3 | 1024 | 智源 BAAI |
| **RagFlow** | bge-large-zh-v1.5 + bge-m3 | 1024 | 智源 BAAI |
| **MaxKB** | bge-m3 | 1024 | 智源 BAAI |
| **阿里百炼** | text-embedding-v4（Qwen3） | 自定义 | 阿里自研 |

---

## 行业标准：BGE 系列

国内 RAG 生产部署 80% 用以下三个之一：
- **bge-large-zh-v1.5**：纯中文最强，最稳
- **bge-m3**：多语言 + 三合一检索，新项目首选
- **text-embedding-v3/v4**：阿里云用户

### BGE 成为标准的 6 个原因

1. **中文效果最好**：C-MTEB 65.4% > OpenAI 62.3%
2. **开源免费**：Apache 2.0，可商用
3. **可私有化部署**：数据不出内网，金融/医疗/政务刚需
4. **BGE-M3 三合一**：稠密+稀疏+多向量，一个模型=Hybrid Search
5. **生态完善**：所有主流平台内置支持
6. **中国团队维护**：智源 BAAI，中文 issue 响应

---

## BGE-M3 的三合一输出

```
普通模型：输入文本 → 1 个稠密向量 → 只能做语义搜索
BGE-M3：输入文本 → 稠密向量（语义） + 稀疏向量（关键词） + 多向量（精细匹配）
```

一个模型 = 我们 L7a(TF-IDF) + L7d(Embedding) + L9(Hybrid) 的合体。

---

## 各模型对比

| 模型 | 中文MTEB | 多语言 | 稀疏向量 | 私有部署 | 成本 |
|---|---|---|---|---|---|
| bge-large-zh-v1.5 | **65.4%** | ❌ | ❌ | ✅ | 免费 |
| bge-m3 | 64.1% | ✅ | **✅** | ✅ | 免费 |
| text-embedding-v3(阿里) | ~63% | ✅ | ❌ | ❌ | 便宜 |
| text-embedding-3-large(OpenAI) | 64.6% | ✅ | ❌ | ❌ | 贵 |
| GTE-large-zh(阿里开源) | 64.8% | 中英 | ❌ | ✅ | 免费 |

---

## 选型决策树

```
纯中文知识库 → bge-large-zh-v1.5
多语言 → bge-m3
阿里云生态 → text-embedding-v4
用 OpenAI → text-embedding-3-large

核心维度：语言覆盖 × 部署方式 × 检索功能
```
