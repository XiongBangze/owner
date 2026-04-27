---
title: "AI Agent 技术入门：从概念到实践"
date: "2026-04-27"
description: "介绍 AI Agent 的核心概念、架构设计和 Python 生态中的实践方案。"
tags: ["AI Agent", "Python", "LangChain"]
---

## 什么是 AI Agent？

AI Agent 是一种能够自主感知环境、做出决策并执行行动的智能系统。与传统的聊天机器人不同，Agent 具备工具调用、记忆管理和任务规划能力。

## 核心组件

- **LLM（大语言模型）**：Agent 的"大脑"，负责理解和推理
- **Tools（工具）**：Agent 可以调用的外部能力，如搜索、数据库查询、API 调用
- **Memory（记忆）**：短期对话记忆和长期知识存储
- **Planning（规划）**：将复杂任务分解为可执行的步骤

## 用 LangChain 构建一个简单 Agent

```python
from langchain.agents import tool, AgentExecutor, create_react_agent
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate

# 定义工具
@tool
def query_order(user_id: str) -> str:
    """查询用户订单信息"""
    return f"用户 {user_id} 有 3 个待发货订单"

@tool
def get_weather(city: str) -> str:
    """查询城市实时天气"""
    return f"{city}：晴，25°C，湿度 60%"

# 创建 Agent
llm = ChatOpenAI(model="gpt-4o", temperature=0)
tools = [query_order, get_weather]

prompt = PromptTemplate.from_template("""你是一个智能助手，可以使用以下工具：

{tools}

工具名称列表：{tool_names}

用户问题：{input}
{agent_scratchpad}""")

agent = create_react_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# 运行
result = executor.invoke({"input": "帮我查一下上海的天气"})
print(result["output"])
```

## Agent 的思考过程

当用户问"帮我查一下上海的天气"时，Agent 的内部推理：

```
Thought: 用户想知道上海的天气，我需要调用 get_weather 工具
Action: get_weather
Action Input: 上海
Observation: 上海：晴，25°C，湿度 60%
Thought: 我已经获取到天气信息，可以回答用户了
Final Answer: 上海今天天气晴朗，气温 25°C，湿度 60%。
```

## 多工具协作

Agent 的强大之处在于能自动编排多个工具：

```python
@tool
def search_knowledge_base(query: str) -> str:
    """从知识库中搜索相关文档"""
    # 调用向量数据库
    docs = vector_store.similarity_search(query, k=3)
    return "\n".join(doc.page_content for doc in docs)

@tool
def send_email(to: str, subject: str, body: str) -> str:
    """发送邮件通知"""
    # 调用邮件 API
    return f"邮件已发送至 {to}"

@tool
def create_ticket(title: str, description: str, priority: str) -> str:
    """创建工单"""
    return f"工单已创建：{title}，优先级：{priority}"
```

当用户说"帮我查一下服务器宕机的处理方案，然后创建一个高优先级工单"，Agent 会：

1. 调用 `search_knowledge_base` 搜索处理方案
2. 根据搜索结果调用 `create_ticket` 创建工单
3. 用自然语言汇总结果

这只是一个起点，后续文章会深入探讨 RAG、Function Calling 等进阶话题。
