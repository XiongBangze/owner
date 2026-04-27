---
title: "LangGraph 构建有状态 Agent"
date: "2026-04-13"
description: "使用 LangGraph 框架构建具备状态管理和循环推理能力的 AI Agent。"
tags: ["LangGraph", "AI Agent", "Python"]
---

传统的 LLM Chain 是线性的——输入经过一系列步骤后输出结果。但真实的 Agent 场景需要循环决策：模型调用工具、观察结果、决定下一步行动，直到任务完成。LangGraph 正是为此而生，它将 Agent 逻辑建模为有向图，节点代表计算步骤，边代表状态转移，天然支持循环、分支和条件路由。

LangGraph 的核心概念包括：State（贯穿整个图的共享状态对象）、Node（执行具体逻辑的函数）、Edge（连接节点的转移规则，支持条件路由）。状态在每个节点执行后自动更新，通过 `add_messages` 等 reducer 函数实现消息的累积。检查点（Checkpoint）机制允许在任意节点暂停和恢复执行，这对长时间运行的 Agent 和人机协作场景至关重要。

与 LangChain 的 AgentExecutor 相比，LangGraph 提供了更细粒度的控制：你可以精确定义每个状态转移的条件，插入人工审批节点，实现多 Agent 协作的复杂拓扑。以下示例构建一个具备工具调用能力的 ReAct Agent：

```python
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def search_web(query: str) -> str:
    """搜索网络获取实时信息"""
    return f"搜索结果: {query} 的最新信息..."

llm = ChatOpenAI(model="gpt-4o").bind_tools([search_web])

def agent_node(state: MessagesState):
    return {"messages": [llm.invoke(state["messages"])]}

def should_continue(state: MessagesState):
    last = state["messages"][-1]
    return "tools" if last.tool_calls else END

graph = StateGraph(MessagesState)
graph.add_node("agent", agent_node)
graph.add_node("tools", ToolNode([search_web]))
graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue)
graph.add_edge("tools", "agent")

app = graph.compile()
result = app.invoke({"messages": [("user", "今天北京天气如何？")]})
print(result["messages"][-1].content)
```

这个图的执行流程是：用户输入 → agent 节点调用 LLM → 如果 LLM 决定调用工具则路由到 tools 节点 → 工具执行后返回 agent 节点继续推理 → 直到 LLM 给出最终回答。
