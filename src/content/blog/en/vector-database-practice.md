---
title: "Vector Databases in Practice: From Theory to Python Integration"
date: "2026-04-18"
description: "Understanding vector database internals, comparing popular options, and implementing semantic search in Python."
tags: ["Vector Database", "Milvus", "FAISS", "Python"]
---

## Why Vector Databases?

Traditional databases excel at exact matching (`WHERE name = 'John'`), but can't handle **semantic similarity** search.

Vector databases convert text into high-dimensional vectors (embeddings) and use **vector distance** to measure semantic similarity.

## Core Concepts

### Embedding

```python
from openai import OpenAI

client = OpenAI()

response = client.embeddings.create(
    model="text-embedding-3-small",
    input=["Python is a programming language", "Python 是一门编程语言"]
)

vec_en = response.data[0].embedding  # [0.12, -0.34, ..., 0.78]  1536 dims
vec_zh = response.data[1].embedding  # [0.11, -0.33, ..., 0.77]  Semantically close

import numpy as np
similarity = np.dot(vec_en, vec_zh) / (np.linalg.norm(vec_en) * np.linalg.norm(vec_zh))
print(f"Similarity: {similarity:.4f}")  # → 0.95+
```

### Distance Metrics

| Metric | Best For |
|--------|----------|
| Cosine similarity | Text semantic search (most common) |
| Euclidean (L2) | Image feature matching |
| Inner product (IP) | Recommendation systems |

### Index Algorithms

- **HNSW**: Graph-based, fast queries, high memory (most popular)
- **IVF**: Clustering-based, good for large datasets
- **PQ**: Product quantization, compresses vectors to save memory

## Comparing Popular Options

| Database | Type | Strengths | Best For |
|----------|------|-----------|----------|
| **FAISS** | Library (Meta) | Local, extremely fast | Prototyping, single-machine |
| **Milvus** | Standalone | Most features, hybrid search | Large-scale production |
| **Qdrant** | Standalone | Rust-based, performant | Medium-large scale |
| **Weaviate** | Standalone | Built-in vectorization | Rapid prototyping |
| **pgvector** | PG extension | No extra deployment | Existing PG projects |
| **Chroma** | Embedded | Lightest, clean API | Development & prototyping |

## Python Integration

### FAISS — Fastest to Start

```python
import faiss
import numpy as np
from openai import OpenAI

client = OpenAI()

documents = [
    "Microservices split applications into independent services",
    "Docker containers simplify deployment workflows",
    "Redis is a high-performance in-memory cache",
    "Kafka is a distributed message queue system",
    "Kubernetes orchestrates and manages containers",
]

response = client.embeddings.create(model="text-embedding-3-small", input=documents)
vectors = np.array([d.embedding for d in response.data], dtype="float32")

# Create FAISS index
dimension = vectors.shape[1]
index = faiss.IndexFlatIP(dimension)
faiss.normalize_L2(vectors)  # Normalized IP = cosine similarity
index.add(vectors)

# Search
query = "How to manage containerized applications?"
q_vec = np.array(
    [client.embeddings.create(model="text-embedding-3-small", input=[query]).data[0].embedding],
    dtype="float32"
)
faiss.normalize_L2(q_vec)

distances, indices = index.search(q_vec, k=3)
for i, idx in enumerate(indices[0]):
    print(f"{i+1}. [{distances[0][i]:.4f}] {documents[idx]}")
```

### Chroma — Simplest API

```python
import chromadb

client = chromadb.Client()
collection = client.create_collection("knowledge_base")

collection.add(
    documents=[
        "Microservices split applications into independent services",
        "Docker containers simplify deployment workflows",
        "Kubernetes orchestrates and manages containers",
    ],
    ids=["doc1", "doc2", "doc3"]
)

results = collection.query(query_texts=["container management"], n_results=2)
print(results["documents"])
```

### Milvus — Production Grade

```python
from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType

connections.connect(host="localhost", port="19530")

fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=2000),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1536),
]
schema = CollectionSchema(fields, description="Knowledge base")
collection = Collection("knowledge_base", schema)

collection.insert([texts, vectors])

collection.create_index(
    field_name="embedding",
    index_params={"index_type": "HNSW", "metric_type": "COSINE", "params": {"M": 16, "efConstruction": 256}}
)
collection.load()

results = collection.search(
    data=[query_vector],
    anns_field="embedding",
    param={"metric_type": "COSINE", "params": {"ef": 64}},
    limit=5,
    output_fields=["text"]
)
for hit in results[0]:
    print(f"[{hit.score:.4f}] {hit.entity.get('text')}")
```

## Document Processing Pipeline

```python
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from datetime import datetime

def build_knowledge_base(data_dir: str, save_path: str):
    loader = DirectoryLoader(data_dir, glob="**/*.pdf", loader_cls=PyPDFLoader)
    documents = loader.load()
    print(f"Loaded {len(documents)} document pages")

    splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=50)
    chunks = splitter.split_documents(documents)
    print(f"Split into {len(chunks)} chunks")

    for chunk in chunks:
        chunk.metadata["indexed_at"] = datetime.now().isoformat()

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vector_store = FAISS.from_documents(chunks, embeddings)
    vector_store.save_local(save_path)
    print(f"Knowledge base saved to {save_path}")

build_knowledge_base("./docs", "./faiss_index")
```

## Performance Tips

1. **Batch writes**: Insert in batches of ~1000 for best throughput
2. **Index selection**: HNSW for < 1M vectors, IVF_HNSW for > 1M
3. **Dimensions**: 1536 (OpenAI) vs 768 (open-source) — lower is faster
4. **Pre-filter**: Use metadata filters to narrow scope before vector search

## Takeaway

Vector databases are the infrastructure behind RAG and semantic search. Start with FAISS or Chroma for prototyping, move to Milvus or Qdrant for production. LangChain's unified VectorStore abstraction lets you swap implementations without changing business code.
