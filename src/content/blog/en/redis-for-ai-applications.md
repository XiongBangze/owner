---
title: "Redis for AI Applications in Practice"
date: "2026-03-25"
description: "Explore core Redis use cases in AI applications, including inference caching, session management, and vector similarity search."
tags: ["Redis", "Cache", "Vector Search"]
---

In AI applications, Redis is far more than a traditional key-value cache — it serves as a high-performance real-time data infrastructure. This article covers three core scenarios.

## Model Inference Caching

LLM inference is expensive. Caching results for identical or similar inputs significantly reduces latency and cost. By hashing the prompt and storing inference results in Redis with a TTL, we can drastically cut redundant API calls without sacrificing user experience.

## Vector Similarity Search

Redis Stack includes a built-in vector search engine (RediSearch) supporting HNSW and FLAT indexing algorithms. We can store text embeddings in Redis Hashes and perform millisecond-level KNN queries for semantic retrieval — ideal for RAG (Retrieval-Augmented Generation) pipelines.

## Session State Management

AI chat applications need to maintain multi-turn conversation context. Redis List or Stream data structures are naturally suited for storing ordered message histories. Combined with TTL-based expiration, they elegantly manage session lifecycles.

The following example demonstrates a complete implementation of inference caching and vector search:

```python
import hashlib
import json
import numpy as np
import redis
from redis.commands.search.field import VectorField, TextField
from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis.commands.search.query import Query

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

# ---- Inference Cache ----
def cached_inference(prompt: str, model_fn, ttl: int = 3600) -> str:
    key = f"llm:cache:{hashlib.sha256(prompt.encode()).hexdigest()}"
    if cached := r.get(key):
        return cached
    result = model_fn(prompt)
    r.setex(key, ttl, result)
    return result

# ---- Vector Search ----
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
