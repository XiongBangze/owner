---
title: "Redis 在 AI 应用中的实践"
date: "2026-03-25"
description: "探索 Redis 在 AI 应用中的核心用法，包括模型推理缓存、会话管理和向量相似度搜索。"
tags: ["Redis", "缓存", "向量搜索"]
---

在 AI 应用中，Redis 不仅是传统的键值缓存，更是一个高性能的实时数据基础设施。本文介绍三个核心场景。

## 模型推理缓存

大语言模型的推理成本高昂，对相同或相似的输入进行缓存可以显著降低延迟和费用。通过对 prompt 进行哈希，将推理结果存入 Redis 并设置 TTL，可以在不牺牲用户体验的前提下大幅减少重复调用。

## 向量相似度搜索

Redis Stack 内置了向量搜索引擎（RediSearch），支持 HNSW 和 FLAT 索引算法。我们可以将文本 embedding 存储在 Redis Hash 中，并通过 KNN 查询实现毫秒级的语义检索，非常适合 RAG（检索增强生成）管道。

## 会话状态管理

AI 聊天应用需要维护多轮对话上下文。Redis 的 List 或 Stream 数据结构天然适合存储有序的消息历史，配合 TTL 自动过期，可以优雅地管理会话生命周期。

以下示例展示了推理缓存和向量搜索的完整实现：

```python
import hashlib
import json
import numpy as np
import redis
from redis.commands.search.field import VectorField, TextField
from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis.commands.search.query import Query

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

# ---- 推理缓存 ----
def cached_inference(prompt: str, model_fn, ttl: int = 3600) -> str:
    key = f"llm:cache:{hashlib.sha256(prompt.encode()).hexdigest()}"
    if cached := r.get(key):
        return cached
    result = model_fn(prompt)
    r.setex(key, ttl, result)
    return result

# ---- 向量搜索 ----
def create_vector_index(dim: int = 768):
    schema = (
        TextField("content"),
        VectorField("embedding", "HNSW", {
            "TYPE": "FLOAT32", "DIM": dim, "DISTANCE_METRIC": "COSINE"
        }),
    )
    r.ft("idx:docs").create_index(
        schema, definition=IndexDefinition(prefix=["doc:"], index_type=IndexType.HASH)
    )

def add_document(doc_id: str, content: str, embedding: list[float]):
    r.hset(f"doc:{doc_id}", mapping={
        "content": content,
        "embedding": np.array(embedding, dtype=np.float32).tobytes(),
    })

def search_similar(query_embedding: list[float], top_k: int = 5):
    q = (
        Query(f"*=>[KNN {top_k} @embedding $vec AS score]")
        .sort_by("score")
        .return_fields("content", "score")
        .dialect(2)
    )
    blob = np.array(query_embedding, dtype=np.float32).tobytes()
    return r.ft("idx:docs").search(q, query_params={"vec": blob})
```
