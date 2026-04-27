---
title: "Building an AI Search Engine"
date: "2026-03-26"
description: "Build a semantic search engine with Python, combining vector retrieval and keyword search for hybrid search"
tags: [Search Engine, Semantic Search, Python]
---

Traditional keyword search (BM25) relies on term frequency matching and cannot understand semantic similarity; pure vector search excels at semantic matching but may miss exact keywords. **Hybrid Search** combines both strengths and is the best practice for building AI search engines.

The core hybrid search architecture has three components: a **BM25 index** for keyword matching (precise recall); a **vector index** for semantic matching (fuzzy recall); and a **fusion ranker** (Reciprocal Rank Fusion or Cross-Encoder Reranker) to merge and rank results from both paths. RRF is the simplest fusion method — no training needed, it sums reciprocal ranks with weights. Cross-Encoder Reranker (e.g., `bge-reranker-v2-m3`) offers higher accuracy but greater computational cost, suitable for re-ranking Top-K results.

Vector database selection is critical. **Qdrant** natively supports hybrid search (dense + sparse vectors); **Milvus** suits large-scale scenarios; for lightweight use cases, **ChromaDB** or **LanceDB** work well. The typical search pipeline is: Query Rewriting → Dual-path Retrieval → Fusion Ranking → Return Results.

```python
from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer

encoder = SentenceTransformer("BAAI/bge-m3")
client = QdrantClient(":memory:")

client.create_collection(
    "docs",
    vectors_config=models.VectorParams(size=1024, distance=models.Distance.COSINE),
)

docs = ["Python async programming guide", "FastAPI streaming response", "Vector database comparison"]
embeddings = encoder.encode(docs).tolist()
client.upsert("docs", points=[
    models.PointStruct(id=i, vector=emb, payload={"text": doc})
    for i, (emb, doc) in enumerate(zip(embeddings, docs))
])

query_vec = encoder.encode("how to implement async").tolist()
results = client.query_points("docs", query=query_vec, limit=3)
for r in results.points:
    print(f"[{r.score:.4f}] {r.payload['text']}")
```

In production, also consider index update strategies (incremental vs. full rebuild), caching popular queries, and using click-through feedback to continuously optimize the ranking model.
