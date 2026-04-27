---
title: "RAG 检索增强生成：让大模型拥有你的私有知识"
date: "2026-04-25"
description: "深入解析 RAG 的原理、架构设计和 Python 实现方案，解决大模型幻觉和知识时效性问题。"
tags: ["RAG", "LLM", "向量数据库", "Python"]
---

## 为什么需要 RAG？

大语言模型有两个致命问题：

1. **幻觉**：模型会一本正经地编造不存在的信息
2. **知识截止**：训练数据有时间截止点，无法获取最新信息

RAG（Retrieval-Augmented Generation，检索增强生成）通过在生成前先检索相关文档，让模型基于真实数据回答问题。

## 核心架构

```
用户提问 → 向量化 → 向量数据库检索 → 拼接上下文 → LLM 生成回答
```

### 1. 索引阶段（离线）

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS

# 1. 加载文档
from langchain_community.document_loaders import PyPDFLoader
loader = PyPDFLoader("knowledge_base.pdf")
documents = loader.load()

# 2. 分块
splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=50,
    separators=["\n\n", "\n", "。", "，", " "]
)
chunks = splitter.split_documents(documents)

# 3. 向量化并存入向量数据库
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vector_store = FAISS.from_documents(chunks, embeddings)
vector_store.save_local("faiss_index")
```

### 2. 检索生成阶段（在线）

```python
from langchain_openai import ChatOpenAI
from langchain.chains import RetrievalQA

# 加载向量数据库
vector_store = FAISS.load_local("faiss_index", embeddings)

# 构建 RAG 链
llm = ChatOpenAI(model="gpt-4o", temperature=0)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vector_store.as_retriever(search_kwargs={"k": 5}),
    return_source_documents=True
)

# 查询
result = qa_chain.invoke({"query": "微服务架构的优缺点是什么？"})
print(result["result"])
```

## 分块策略详解

分块是 RAG 效果的关键因素：

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 固定大小 | 实现简单 | 可能切断语义 | 结构化文档 |
| 按段落/句子 | 保持语义完整 | 块大小不均匀 | 文章、报告 |
| 递归分块 | 平衡语义和大小 | 实现复杂 | 通用场景 |
| 语义分块 | 语义最完整 | 计算成本高 | 高质量要求 |

```python
# 递归分块 — 最推荐的通用方案
splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,      # 块大小
    chunk_overlap=50,    # 重叠（避免边界信息丢失）
    separators=["\n\n", "\n", "。", "！", "？", "，", " ", ""]
)

# 语义分块 — 基于 Embedding 相似度切分
from langchain_experimental.text_splitter import SemanticChunker
semantic_splitter = SemanticChunker(
    embeddings,
    breakpoint_threshold_type="percentile"
)
```

## 提升 RAG 效果的进阶技巧

### 混合检索

向量检索 + 关键词检索（BM25）结合，效果更好：

```python
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever

# BM25 关键词检索
bm25_retriever = BM25Retriever.from_documents(chunks)
bm25_retriever.k = 5

# 向量检索
vector_retriever = vector_store.as_retriever(search_kwargs={"k": 5})

# 混合检索（各占 50% 权重）
ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, vector_retriever],
    weights=[0.5, 0.5]
)
```

### 查询改写

用户的原始问题可能不适合直接检索：

```python
from langchain.prompts import ChatPromptTemplate

rewrite_prompt = ChatPromptTemplate.from_template(
    "将以下用户问题改写为更适合搜索的形式，只输出改写后的问题：\n{question}"
)

chain = rewrite_prompt | llm
rewritten = chain.invoke({"question": "系统最近老是挂怎么办"})
# → "分布式系统高可用性故障排查与解决方案"
```

### Re-ranking

检索后对结果重新排序，过滤不相关文档：

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain_cohere import CohereRerank

reranker = CohereRerank(model="rerank-v3.5", top_n=3)
compression_retriever = ContextualCompressionRetriever(
    base_compressor=reranker,
    base_retriever=vector_retriever
)

docs = compression_retriever.invoke("微服务架构设计")
```

## 完整的 RAG 应用示例

```python
from langchain.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

# 自定义 Prompt
template = """基于以下参考资料回答用户问题。如果资料中没有相关信息，请明确说明。

参考资料：
{context}

用户问题：{question}

回答："""

prompt = ChatPromptTemplate.from_template(template)

# 构建 LCEL 链
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain = (
    {"context": ensemble_retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

# 使用
answer = rag_chain.invoke("如何设计高可用的微服务架构？")
print(answer)
```

## 生产环境注意事项

1. **监控检索质量**：记录每次检索的相关性分数，持续优化
2. **文档更新策略**：增量索引 vs 全量重建
3. **成本控制**：Embedding 调用量大时考虑本地模型（如 BGE、M3E）
4. **安全性**：确保检索结果不泄露敏感信息，做好权限隔离

RAG 不是银弹，但它是目前让 LLM 落地企业场景最实用的方案。
