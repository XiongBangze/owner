---
title: "对话记忆管理策略"
date: "2026-04-03"
description: "探讨 LLM 应用中的对话记忆管理方案，包括滑动窗口、摘要压缩与向量检索记忆"
tags: [Memory, 对话管理, LangChain]
---

大语言模型本身是无状态的，每次请求都是独立的。要实现多轮对话，必须在应用层管理对话记忆（Conversation Memory）。最朴素的方案是将全部历史消息拼接到 prompt 中，但这会迅速耗尽上下文窗口并增加成本。

常见的记忆管理策略有三种。**滑动窗口记忆**（Buffer Window Memory）只保留最近 K 轮对话，实现简单但会丢失早期上下文。**摘要记忆**（Summary Memory）用 LLM 对历史对话生成摘要，用摘要替代原始消息，在压缩 token 的同时保留关键信息。**向量检索记忆**（Vector Store Memory）将每轮对话 embedding 后存入向量数据库，查询时检索与当前问题最相关的历史片段，适合长期记忆场景。

在实际项目中，混合策略效果最佳：近期对话用滑动窗口保持连贯性，远期对话用向量检索按需召回，同时维护一份全局摘要提供背景。LangChain 提供了开箱即用的记忆组件，可以快速实现这些策略。

```python
from langchain.memory import ConversationSummaryBufferMemory
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 混合策略：缓冲区保留最近 2000 token，超出部分自动摘要
memory = ConversationSummaryBufferMemory(
    llm=llm,
    max_token_limit=2000,
    return_messages=True,
)

memory.save_context(
    {"input": "我想搭建一个 RAG 系统"},
    {"output": "好的，RAG 系统主要包含文档解析、向量化、检索和生成四个模块..."},
)
memory.save_context(
    {"input": "向量数据库用什么好？"},
    {"output": "推荐 Milvus 或 Qdrant，前者适合大规模场景..."},
)

# 加载记忆用于下一轮对话
history = memory.load_memory_variables({})
print(history["history"])
```

选择策略时需权衡 token 成本、信息保真度和检索延迟三个维度。
