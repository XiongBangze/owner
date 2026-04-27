---
title: "向量数据库实战：从原理到 Python 集成"
date: "2026-04-18"
description: "理解向量数据库的核心原理，对比主流方案，并在 Python 项目中实现语义搜索。"
tags: ["向量数据库", "Milvus", "FAISS", "Python"]
---

## 为什么需要向量数据库？

传统数据库擅长精确匹配（`WHERE name = '张三'`），但无法处理**语义相似性**搜索。

搜索"如何提升系统性能"，你希望也能匹配到"优化服务响应速度"——字面不同，语义相近。

向量数据库通过将文本转换为高维向量（Embedding），用**向量距离**衡量语义相似度。

## 核心概念

### Embedding（向量化）

```python
from openai import OpenAI

client = OpenAI()

# 将文本转换为向量
response = client.embeddings.create(
    model="text-embedding-3-small",
    input=["Java 是一门编程语言", "Java is a programming language"]
)

vec_zh = response.data[0].embedding  # [0.12, -0.34, ..., 0.78]  1536维
vec_en = response.data[1].embedding  # [0.11, -0.33, ..., 0.77]  语义相近

# 计算余弦相似度
import numpy as np
similarity = np.dot(vec_zh, vec_en) / (np.linalg.norm(vec_zh) * np.linalg.norm(vec_en))
print(f"相似度: {similarity:.4f}")  # → 0.95+
```

### 相似度度量

| 度量方式 | 适用场景 |
|---------|---------|
| 余弦相似度 | 文本语义搜索（最常用） |
| 欧氏距离 (L2) | 图像特征匹配 |
| 内积 (IP) | 推荐系统 |

### 索引算法

向量数据库用近似最近邻（ANN）算法加速检索：

- **HNSW**：基于图，查询快，内存大（最常用）
- **IVF**：基于聚类，适合大规模数据
- **PQ**：乘积量化，压缩向量降低内存

## 主流方案对比

| 数据库 | 类型 | 特点 | 适用场景 |
|--------|------|------|---------|
| **FAISS** | 库（Meta） | 纯本地，性能极高 | 原型验证、单机场景 |
| **Milvus** | 独立部署 | 功能最全，混合检索 | 大规模生产环境 |
| **Qdrant** | 独立部署 | Rust 编写，性能好 | 中大规模 |
| **Weaviate** | 独立部署 | 内置向量化模块 | 快速原型 |
| **pgvector** | PG 扩展 | 无需额外部署 | 已有 PG 的项目 |
| **Chroma** | 嵌入式 | 最轻量，API 简洁 | 开发和原型 |

## Python 集成实战

### FAISS — 最快上手

```python
import faiss
import numpy as np
from openai import OpenAI

client = OpenAI()

# 准备文档
documents = [
    "微服务架构将应用拆分为多个独立服务",
    "Docker 容器化技术简化了部署流程",
    "Redis 是高性能的内存缓存数据库",
    "Kafka 是分布式消息队列系统",
    "Kubernetes 用于容器编排和管理",
]

# 向量化
response = client.embeddings.create(
    model="text-embedding-3-small",
    input=documents
)
vectors = np.array([d.embedding for d in response.data], dtype="float32")

# 创建 FAISS 索引
dimension = vectors.shape[1]
index = faiss.IndexFlatIP(dimension)  # 内积相似度
faiss.normalize_L2(vectors)           # 归一化后内积 = 余弦相似度
index.add(vectors)

# 搜索
query = "如何管理容器化应用？"
q_vec = np.array(
    [client.embeddings.create(model="text-embedding-3-small", input=[query]).data[0].embedding],
    dtype="float32"
)
faiss.normalize_L2(q_vec)

distances, indices = index.search(q_vec, k=3)
for i, idx in enumerate(indices[0]):
    print(f"{i+1}. [{distances[0][i]:.4f}] {documents[idx]}")
```

### Chroma — 最简洁

```python
import chromadb

client = chromadb.Client()
collection = client.create_collection("knowledge_base")

# 添加文档（自动向量化）
collection.add(
    documents=[
        "微服务架构将应用拆分为多个独立服务",
        "Docker 容器化技术简化了部署流程",
        "Kubernetes 用于容器编排和管理",
    ],
    ids=["doc1", "doc2", "doc3"]
)

# 搜索
results = collection.query(
    query_texts=["如何管理容器化应用？"],
    n_results=2
)
print(results["documents"])
```

### Milvus — 生产级

```python
from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType, utility

# 连接
connections.connect(host="localhost", port="19530")

# 定义 Schema
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=2000),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1536),
]
schema = CollectionSchema(fields, description="知识库")
collection = Collection("knowledge_base", schema)

# 插入数据
collection.insert([
    texts,       # text 字段
    vectors,     # embedding 字段
])

# 创建索引
collection.create_index(
    field_name="embedding",
    index_params={"index_type": "HNSW", "metric_type": "COSINE", "params": {"M": 16, "efConstruction": 256}}
)
collection.load()

# 搜索
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

## 文档处理管道

从原始文档到向量入库的完整管道：

```python
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS

def build_knowledge_base(data_dir: str, save_path: str):
    # 1. 加载文档（支持 PDF、TXT、MD 等）
    loader = DirectoryLoader(data_dir, glob="**/*.pdf", loader_cls=PyPDFLoader)
    documents = loader.load()
    print(f"加载了 {len(documents)} 个文档页面")

    # 2. 分块
    splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=50)
    chunks = splitter.split_documents(documents)
    print(f"分成了 {len(chunks)} 个文本块")

    # 3. 添加元数据
    for chunk in chunks:
        chunk.metadata["indexed_at"] = datetime.now().isoformat()

    # 4. 向量化并存储
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vector_store = FAISS.from_documents(chunks, embeddings)
    vector_store.save_local(save_path)
    print(f"知识库已保存到 {save_path}")

build_knowledge_base("./docs", "./faiss_index")
```

## 性能优化要点

1. **批量写入**：避免逐条插入，批量 1000 条效率最高
2. **索引选择**：数据量 < 100w 用 HNSW，> 100w 考虑 IVF_HNSW
3. **维度选择**：1536 维（OpenAI）vs 768 维（开源模型），维度越低越快
4. **过滤优化**：先用元数据过滤缩小范围，再做向量搜索

## 总结

向量数据库是 RAG 和语义搜索的基础设施。快速验证用 FAISS 或 Chroma，生产环境用 Milvus 或 Qdrant。LangChain 提供了统一的 VectorStore 抽象，可以在不改业务代码的情况下切换底层实现。
