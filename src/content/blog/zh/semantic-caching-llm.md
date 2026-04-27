---
title: "语义缓存加速 LLM 应用"
date: "2026-04-08"
description: "利用语义相似度缓存策略大幅降低 LLM 调用成本和响应延迟。"
tags: ["缓存", "Redis", "语义搜索"]
---

LLM API 调用的成本和延迟是生产环境中的两大痛点。传统的精确匹配缓存对 LLM 场景几乎无效——用户很少用完全相同的措辞提问。语义缓存（Semantic Cache）通过向量相似度匹配，将语义相近的查询映射到已缓存的回答，即使措辞不同也能命中缓存。例如"Python 怎么读文件"和"如何用 Python 打开并读取文件内容"虽然文字不同，但语义高度相似，应返回相同的缓存结果。

实现语义缓存的核心组件包括：Embedding 模型（将查询转为向量）、向量数据库（存储和检索相似向量）、相似度阈值（控制缓存命中的精度）。Redis Stack 内置了向量搜索能力，是语义缓存的理想选择——它同时提供了 TTL 过期、内存管理和高并发支持。

关键设计决策包括：相似度阈值通常设为 0.92-0.95（太低会返回不相关结果，太高则命中率过低）；缓存粒度建议按完整问答对存储而非仅缓存 embedding；需要考虑缓存失效策略，对时效性强的问题设置较短 TTL。实测表明，语义缓存可将重复类问题的响应时间从 2-5 秒降至 50ms 以内，成本节省 40-70%。

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
    # 使用 Redis 向量搜索查找相似缓存
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
        return cached  # 缓存命中，跳过 LLM 调用
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

语义缓存特别适合客服、FAQ、文档问答等重复率高的场景，是 LLM 应用成本优化的第一优先级手段。
