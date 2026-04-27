---
title: "RAG: Giving LLMs Access to Your Private Knowledge"
date: "2026-04-25"
description: "Deep dive into RAG architecture, chunking strategies, and Python implementation for enterprise AI applications."
tags: ["RAG", "LLM", "Vector Database", "Python"]
---

## Why RAG?

Large Language Models have two critical limitations:

1. **Hallucination**: Models confidently generate fabricated information
2. **Knowledge cutoff**: Training data has a fixed cutoff date

RAG (Retrieval-Augmented Generation) solves both by retrieving relevant documents before generation.

## Core Architecture

```
User Query → Vectorize → Vector DB Search → Build Context → LLM Generation
```

### 1. Indexing Phase (Offline)

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader

# Load documents
loader = PyPDFLoader("knowledge_base.pdf")
documents = loader.load()

# Chunk
splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=50,
    separators=["\n\n", "\n", ". ", ", ", " "]
)
chunks = splitter.split_documents(documents)

# Vectorize and store
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vector_store = FAISS.from_documents(chunks, embeddings)
vector_store.save_local("faiss_index")
```

### 2. Retrieval & Generation (Online)

```python
from langchain_openai import ChatOpenAI
from langchain.chains import RetrievalQA

vector_store = FAISS.load_local("faiss_index", embeddings)

llm = ChatOpenAI(model="gpt-4o", temperature=0)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vector_store.as_retriever(search_kwargs={"k": 5}),
    return_source_documents=True
)

result = qa_chain.invoke({"query": "What are the pros and cons of microservices?"})
print(result["result"])
```

## Chunking Strategies

| Strategy | Pros | Cons | Best For |
|----------|------|------|----------|
| Fixed-size | Simple | May break semantics | Structured docs |
| Paragraph/Sentence | Preserves meaning | Uneven sizes | Articles, reports |
| Recursive | Balanced | Complex | General purpose |
| Semantic | Best coherence | Expensive | High-quality needs |

```python
# Recursive chunking — recommended general approach
splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=50,
    separators=["\n\n", "\n", ". ", ", ", " ", ""]
)

# Semantic chunking — splits based on embedding similarity
from langchain_experimental.text_splitter import SemanticChunker
semantic_splitter = SemanticChunker(
    embeddings,
    breakpoint_threshold_type="percentile"
)
```

## Advanced Techniques

### Hybrid Search

Combine vector search with keyword search (BM25):

```python
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever

bm25_retriever = BM25Retriever.from_documents(chunks)
bm25_retriever.k = 5

vector_retriever = vector_store.as_retriever(search_kwargs={"k": 5})

ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, vector_retriever],
    weights=[0.5, 0.5]
)
```

### Query Rewriting

```python
from langchain.prompts import ChatPromptTemplate

rewrite_prompt = ChatPromptTemplate.from_template(
    "Rewrite this question for better search results. Output only the rewritten question:\n{question}"
)

chain = rewrite_prompt | llm
rewritten = chain.invoke({"question": "why does the system keep crashing"})
# → "distributed system high availability failure troubleshooting"
```

### Re-ranking

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain_cohere import CohereRerank

reranker = CohereRerank(model="rerank-v3.5", top_n=3)
compression_retriever = ContextualCompressionRetriever(
    base_compressor=reranker,
    base_retriever=vector_retriever
)
```

## Complete RAG Application

```python
from langchain.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

template = """Answer based on the following references. If the information is not available, say so.

References:
{context}

Question: {question}

Answer:"""

prompt = ChatPromptTemplate.from_template(template)

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain = (
    {"context": ensemble_retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

answer = rag_chain.invoke("How to design a highly available microservices architecture?")
```

## Production Considerations

1. **Monitor retrieval quality**: Log relevance scores, continuously optimize
2. **Document update strategy**: Incremental indexing vs full rebuild
3. **Cost control**: Consider local embedding models (BGE, M3E) for high volume
4. **Security**: Ensure retrieval results don't leak sensitive data

RAG is not a silver bullet, but it's currently the most practical approach for deploying LLMs in enterprise scenarios.
