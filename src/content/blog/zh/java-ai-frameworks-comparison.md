---
title: "Python AI 框架对比：LangChain vs LlamaIndex vs AutoGen"
date: "2026-04-20"
description: "从架构设计、功能覆盖、生态集成等维度对比 Python 生态三大 AI 框架，帮你选择最适合的方案。"
tags: ["LangChain", "LlamaIndex", "AutoGen", "Python"]
---

## Python AI 框架选择

Python 是 AI 开发的首选语言，框架生态非常丰富。目前三个最主流的框架：

- **LangChain** — 最流行的 LLM 应用框架
- **LlamaIndex** — 专注于数据索引和检索
- **AutoGen** — 微软出品，专注多 Agent 协作

## 框架对比总览

| 维度 | LangChain | LlamaIndex | AutoGen |
|------|-----------|------------|---------|
| 定位 | 通用 LLM 应用框架 | 数据索引与检索 | 多 Agent 协作 |
| 核心能力 | Chain/Agent/Tool | Index/Query/RAG | Agent 对话编排 |
| RAG 支持 | ✅ 通用方案 | ✅ 最强（专精） | ✅ 基础支持 |
| Agent | ✅ 丰富 | ⚠️ 基础 | ✅ 最强（专精） |
| 学习曲线 | 中 | 低 | 中 |
| 社区活跃度 | 最高 | 高 | 高 |

## LangChain

最全面的 LLM 应用框架，覆盖从简单对话到复杂 Agent 的所有场景：

```python
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# LCEL（LangChain Expression Language）— 声明式链
llm = ChatOpenAI(model="gpt-4o")

# 简单链
chain = (
    ChatPromptTemplate.from_template("用一句话解释什么是{topic}")
    | llm
    | StrOutputParser()
)
result = chain.invoke({"topic": "微服务架构"})

# 带记忆的对话
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain

memory = ConversationBufferMemory()
conversation = ConversationChain(llm=llm, memory=memory)
conversation.predict(input="你好，我叫邦泽")
conversation.predict(input="我叫什么名字？")  # 能记住上下文
```

### 核心优势

- **LCEL**：用管道符 `|` 组合组件，代码简洁直观
- **生态最丰富**：200+ 集成（各种 LLM、向量数据库、工具）
- **LangSmith**：官方可观测性平台，调试和监控链路

### 适用场景

通用 LLM 应用、Agent、RAG、对话系统、工作流编排

## LlamaIndex

如果你的核心需求是 **RAG 和数据检索**，LlamaIndex 是最佳选择：

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader

# 三行代码实现 RAG
documents = SimpleDirectoryReader("./data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()

response = query_engine.query("这份文档的核心观点是什么？")
print(response)
```

### 高级检索策略

```python
from llama_index.core import VectorStoreIndex, SummaryIndex
from llama_index.core.tools import QueryEngineTool
from llama_index.core.query_engine import RouterQueryEngine

# 向量检索引擎（语义搜索）
vector_index = VectorStoreIndex.from_documents(documents)
vector_tool = QueryEngineTool.from_defaults(
    query_engine=vector_index.as_query_engine(),
    description="用于语义相似度搜索的工具"
)

# 摘要检索引擎（全局理解）
summary_index = SummaryIndex.from_documents(documents)
summary_tool = QueryEngineTool.from_defaults(
    query_engine=summary_index.as_query_engine(),
    description="用于获取文档整体摘要的工具"
)

# 路由引擎：自动选择最合适的检索策略
router_engine = RouterQueryEngine.from_defaults(
    query_engine_tools=[vector_tool, summary_tool]
)

# "这份文档讲了什么" → 走摘要引擎
# "文档中提到了哪些优化方案" → 走向量引擎
```

### 核心优势

- **数据连接器**：160+ 种数据源（PDF、Notion、Slack、数据库等）
- **索引策略丰富**：向量、关键词、树形、知识图谱等
- **检索优化**：内置 Re-ranking、查询改写、混合检索

### 适用场景

知识库问答、文档分析、企业搜索、数据管道

## AutoGen

微软出品，专注于**多 Agent 协作**场景：

```python
from autogen import AssistantAgent, UserProxyAgent

# 创建 AI 助手
assistant = AssistantAgent(
    name="assistant",
    llm_config={"model": "gpt-4o"},
    system_message="你是一个 Python 编程专家。"
)

# 创建用户代理（可以执行代码）
user_proxy = UserProxyAgent(
    name="user",
    human_input_mode="NEVER",
    code_execution_config={"work_dir": "coding"},
)

# 发起对话：Agent 会写代码并自动执行
user_proxy.initiate_chat(
    assistant,
    message="写一个 Python 脚本，分析 data.csv 中的销售趋势并画图"
)
```

### 多 Agent 协作

```python
from autogen import GroupChat, GroupChatManager

# 产品经理 Agent
pm = AssistantAgent(
    name="product_manager",
    system_message="你是产品经理，负责分析需求和制定方案。"
)

# 开发者 Agent
developer = AssistantAgent(
    name="developer",
    system_message="你是 Python 开发者，负责编写代码实现需求。"
)

# 测试 Agent
tester = AssistantAgent(
    name="tester",
    system_message="你是测试工程师，负责审查代码并提出改进建议。"
)

# 组建团队
group_chat = GroupChat(
    agents=[user_proxy, pm, developer, tester],
    messages=[],
    max_round=12
)
manager = GroupChatManager(groupchat=group_chat)

# 发起协作
user_proxy.initiate_chat(manager, message="开发一个用户注册功能的 REST API")
```

### 核心优势

- **多 Agent 对话**：Agent 之间可以自主讨论和协作
- **代码执行**：Agent 可以写代码并在沙箱中运行
- **灵活编排**：支持顺序、并行、嵌套等多种协作模式

### 适用场景

代码生成、多角色协作、自动化工作流、研究探索

## 如何选择？

```
你的核心需求是什么？
├── RAG / 知识库问答 → LlamaIndex（检索最强）
├── 多 Agent 协作 → AutoGen（编排最强）
├── 通用 LLM 应用 → LangChain（生态最全）
└── 不确定 → LangChain（最灵活，后续可组合其他框架）
```

**实际项目中经常混用**：用 LlamaIndex 做数据索引，用 LangChain 做 Agent 编排，用 AutoGen 做多角色协作。它们不是互斥的。
