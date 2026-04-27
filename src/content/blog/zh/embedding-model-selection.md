---
title: "Embedding 模型选型"
date: "2026-04-01"
description: "对比主流 Embedding 模型的性能与适用场景，帮助你为 RAG 系统选择最合适的向量化方案"
tags: [Embedding, BGE, OpenAI]
---

Embedding 模型将文本映射为稠密向量，是语义搜索和 RAG 系统的基础组件。选型时需要关注以下维度：向量维度、最大输入长度、多语言支持、检索精度（MTEB 排行榜得分）以及推理成本。

**OpenAI text-embedding-3-small/large** 是商业方案的首选。small 版本 1536 维，性价比极高；large 版本 3072 维，精度更好。两者都支持 `dimensions` 参数动态降维，可在精度和存储间灵活权衡。缺点是依赖 API 调用，有网络延迟和数据隐私顾虑。

**BGE 系列**（BAAI 智源）是开源中文 Embedding 的标杆。`bge-large-zh-v1.5` 在中文检索任务上表现优异，`bge-m3` 支持多语言和多粒度检索（稠密+稀疏+ColBERT），是目前最灵活的开源方案。可本地部署，无隐私风险。

**Cohere embed-v3** 和 **Jina Embeddings v2** 也值得关注，前者支持搜索/分类/聚类多种任务类型，后者支持 8192 token 长文本输入。

选型建议：中文场景优先 BGE-M3；英文或多语言场景可选 OpenAI 或 Cohere；对延迟敏感的场景本地部署 BGE 或 GTE 系列。

```python
from sentence_transformers import SentenceTransformer
import numpy as np

# 本地加载 BGE-M3 模型
model = SentenceTransformer("BAAI/bge-m3")

docs = ["RAG 系统的核心是检索增强", "向量数据库存储文档嵌入"]
query = "什么是 RAG？"

doc_embeddings = model.encode(docs, normalize_embeddings=True)
query_embedding = model.encode([query], normalize_embeddings=True)

# 余弦相似度（已归一化，点积即余弦）
scores = query_embedding @ doc_embeddings.T
best_idx = int(np.argmax(scores))
print(f"最相关文档: {docs[best_idx]}  得分: {scores[0][best_idx]:.4f}")
```

务必在自己的数据集上做 benchmark，公开排行榜得分不一定反映你的实际场景。
