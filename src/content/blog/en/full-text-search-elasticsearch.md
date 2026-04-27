---
title: "Full-Text Search Engine in Practice"
date: "2026-03-12"
description: "Building a full-text search system with Elasticsearch, covering index design, analyzer configuration, relevance tuning, and Python client integration."
tags: ["Elasticsearch", "search", "Python"]
---

Elasticsearch is the most popular distributed full-text search engine, built on Lucene, providing near real-time (NRT) search and analytics. Understanding its core concepts — Index, Document, Mapping, and Analyzer — is fundamental to building high-quality search systems.

**Index design** is critical to search quality. A well-defined Mapping determines how fields are indexed and searched. For Chinese text, you need to configure the IK analyzer instead of the default Standard Analyzer for accurate tokenization. Use `keyword` type for exact-match fields (IDs, statuses) and `text` type for full-text search fields.

**Relevance tuning** directly impacts search experience. Elasticsearch uses the BM25 algorithm by default for relevance scoring. The `function_score` query allows custom scoring factors (time decay, popularity boosting), while `multi_match` with `best_fields` and `cross_fields` strategies optimizes multi-field search.

In production, you also need to consider shard strategies, search performance optimization (using filter context to skip scoring), and improving search fault tolerance and UX through Synonym and Suggest APIs.

```python
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

# Create index with mapping
es.indices.create(index="articles", body={
    "settings": {"analysis": {"analyzer": {"ik_smart": {"type": "custom", "tokenizer": "ik_smart"}}}},
    "mappings": {"properties": {
        "title": {"type": "text", "analyzer": "ik_smart", "boost": 2.0},
        "content": {"type": "text", "analyzer": "ik_smart"},
        "tags": {"type": "keyword"},
        "created_at": {"type": "date"}
    }}
}, ignore=400)

# Index a document
es.index(index="articles", body={"title": "Python Async Programming", "content": "asyncio is the core module...", "tags": ["Python"], "created_at": "2026-03-12"})

# Multi-field search + time decay boosting
results = es.search(index="articles", body={
    "query": {"function_score": {
        "query": {"multi_match": {"query": "async programming", "fields": ["title^3", "content"], "type": "best_fields"}},
        "functions": [{"gauss": {"created_at": {"origin": "now", "scale": "30d", "decay": 0.5}}}]
    }}
})
for hit in results["hits"]["hits"]:
    print(f"{hit['_score']:.2f} | {hit['_source']['title']}")
```
