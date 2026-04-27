---
title: "Semantic Caching to Accelerate LLM Applications"
date: "2026-04-08"
description: "Leverage semantic similarity caching strategies to dramatically reduce LLM call costs and response latency."
tags: ["Caching", "Redis", "Semantic Search"]
---

LLM API call cost and latency are two major pain points in production. Traditional exact-match caching is nearly useless for LLM scenarios — users rarely ask questions with identical wording. Semantic Cache uses vector similarity matching to map semantically similar queries to cached answers, achieving cache hits even with different phrasing. For example, "how to read a file in Python" and "how do I open and read file contents using Python" differ in wording but are semantically equivalent and should return the same cached result.

Core components for implementing semantic caching include: an Embedding model (converting queries to vectors), a vector database (storing and retrieving similar vectors), and a similarity threshold (controlling cache hit precision). Redis Stack has built-in vector search capabilities, making it ideal for semantic caching — it simultaneously provides TTL expiration, memory management, and high-concurrency support.

Key design decisions include: similarity threshold is typically set to 0.92-0.95 (too low returns irrelevant results, too high yields poor hit rates); cache granularity should store complete Q&A pairs rather than just embeddings; cache invalidation strategies must account for time-sensitive questions with shorter TTLs. Benchmarks show semantic caching can reduce response time for repetitive queries from 2-5 seconds to under 50ms, saving 40-70% in costs.

```python
import json
import numpy as np
import redis
from openai import OpenAI

client = OpenAI()
r = redis.Redis(host="localhost", port=6379, decode_responses=True)
THRESHOLD = 0.93

def get_embedding(text: str) -> list[float]:
    resp = client.embeddings.create(model="text-embedding-3-small", input=text)
    return resp.data[0].embedding

def semantic_cache_query(question: str) -> str | None:
    q_emb = get_embedding(question)
    # Use Redis vector search to find similar cached entries
    results = r.ft("cache_idx").search(
        f"*=>[KNN 1 @embedding $vec AS score]",
        query_params={"vec": np.array(q_emb, dtype=np.float32).tobytes()},
    )
    if results.docs and float(results.docs[0].score) >= THRESHOLD:
        return json.loads(r.get(f"cache:{results.docs[0].id}"))["answer"]
    return None

def cached_llm_call(question: str) -> str:
    cached = semantic_cache_query(question)
    if cached:
        return cached  # Cache hit, skip LLM call
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": question}],
    )
    answer = resp.choices[0].message.content
    emb = get_embedding(question)
    cache_id = str(hash(question))
    r.set(f"cache:{cache_id}", json.dumps({"q": question, "answer": answer}), ex=3600)
    return answer
```

Semantic caching is especially effective for high-repetition scenarios like customer service, FAQs, and document Q&A — it should be the first priority for LLM application cost optimization.
