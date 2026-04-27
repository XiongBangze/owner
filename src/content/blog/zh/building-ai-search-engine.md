---
title: "构建 AI 搜索引擎"
date: "2026-03-26"
description: "使用 Python 构建语义搜索引擎，结合向量检索与关键词搜索实现混合搜索"
tags: [搜索引擎, 语义搜索, Python]
---

传统关键词搜索（BM25）依赖词频匹配，无法理解语义相似性；纯向量搜索擅长语义匹配但可能忽略精确关键词。**混合搜索**（Hybrid Search）结合两者优势，是构建 AI 搜索引擎的最佳实践。

混合搜索的核心架构包含三个组件：**BM25 索引**负责关键词匹配（精确召回）；**向量索引**负责语义匹配（模糊召回）；**融合排序器**（Reciprocal Rank Fusion 或 Cross-Encoder Reranker）将两路结果合并排序。RRF 是最简单的融合方法，无需训练，按排名倒数加权求和；Cross-Encoder Reranker（如 `bge-reranker-v2-m3`）精度更高但计算成本也更大，适合对 Top-K 结果做精排。

实现时，向量数据库的选择很关键。**Qdrant** 原生支持混合搜索（稠密+稀疏向量）；**Milvus** 适合大规模场景；轻量级场景可用 **ChromaDB** 或 **LanceDB**。搜索管线通常是：查询改写 → 双路检索 → 融合排序 → 返回结果。

```python
from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer

encoder = SentenceTransformer("BAAI/bge-m3")
client = QdrantClient(":memory:")

client.create_collection(
    "docs",
    vectors_config=models.VectorParams(size=1024, distance=models.Distance.COSINE),
)

docs = ["Python 异步编程指南", "FastAPI 流式响应实现", "向量数据库选型对比"]
embeddings = encoder.encode(docs).tolist()
client.upsert("docs", points=[
    models.PointStruct(id=i, vector=emb, payload={"text": doc})
    for i, (emb, doc) in enumerate(zip(embeddings, docs))
])

query_vec = encoder.encode("如何实现异步").tolist()
results = client.query_points("docs", query=query_vec, limit=3)
for r in results.points:
    print(f"[{r.score:.4f}] {r.payload['text']}")
```

生产环境中还需考虑索引更新策略（增量 vs 全量重建）、缓存热门查询、以及搜索结果的点击反馈用于持续优化排序模型。
