---
title: "全文搜索引擎实践"
date: "2026-03-12"
description: "基于 Elasticsearch 构建全文搜索系统，涵盖索引设计、分词配置、相关性调优与 Python 客户端集成。"
tags: ["Elasticsearch", "搜索", "Python"]
---

Elasticsearch 是当前最流行的分布式全文搜索引擎，基于 Lucene 构建，提供近实时（NRT）的搜索和分析能力。理解其核心概念——索引（Index）、文档（Document）、映射（Mapping）和分析器（Analyzer）——是构建高质量搜索系统的基础。

**索引设计**是搜索质量的关键。合理的 Mapping 定义决定了字段如何被索引和搜索。对于中文场景，需要配置 IK 分词器替代默认的 Standard Analyzer，以实现准确的中文分词。同时，使用 `keyword` 类型处理精确匹配字段（如 ID、状态），用 `text` 类型处理全文搜索字段。

**相关性调优**直接影响搜索体验。Elasticsearch 默认使用 BM25 算法计算相关性评分。通过 `function_score` 查询可以引入自定义评分因子（如时间衰减、热度加权），通过 `multi_match` 的 `best_fields` 和 `cross_fields` 策略优化多字段搜索。

在生产环境中，还需关注索引分片策略、搜索性能优化（如使用 filter 上下文避免评分计算）、以及通过 Synonym 和 Suggest API 提升搜索的容错性和用户体验。

```python
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

# 创建索引并配置映射
es.indices.create(index="articles", body={
    "settings": {"analysis": {"analyzer": {"ik_smart": {"type": "custom", "tokenizer": "ik_smart"}}}},
    "mappings": {"properties": {
        "title": {"type": "text", "analyzer": "ik_smart", "boost": 2.0},
        "content": {"type": "text", "analyzer": "ik_smart"},
        "tags": {"type": "keyword"},
        "created_at": {"type": "date"}
    }}
}, ignore=400)

# 索引文档
es.index(index="articles", body={"title": "Python异步编程", "content": "asyncio是核心模块...", "tags": ["Python"], "created_at": "2026-03-12"})

# 多字段搜索 + 时间衰减加权
results = es.search(index="articles", body={
    "query": {"function_score": {
        "query": {"multi_match": {"query": "异步编程", "fields": ["title^3", "content"], "type": "best_fields"}},
        "functions": [{"gauss": {"created_at": {"origin": "now", "scale": "30d", "decay": 0.5}}}]
    }}
})
for hit in results["hits"]["hits"]:
    print(f"{hit['_score']:.2f} | {hit['_source']['title']}")
```
