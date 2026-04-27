---
title: "Building Stateful Agents with LangGraph"
date: "2026-04-13"
description: "Use the LangGraph framework to build AI Agents with state management and cyclic reasoning capabilities."
tags: ["LangGraph", "AI Agent", "Python"]
---

Traditional LLM Chains are linear — input passes through a series of steps to produce output. But real-world Agent scenarios require cyclic decision-making: the model calls tools, observes results, and decides the next action until the task is complete. LangGraph is built for exactly this, modeling Agent logic as a directed graph where nodes represent computation steps and edges represent state transitions, with native support for loops, branching, and conditional routing.

LangGraph's core concepts include: State (a shared state object throughout the graph), Node (functions executing specific logic), and Edge (transition rules connecting nodes with conditional routing support). State is automatically updated after each node execution through reducer functions like `add_messages` for message accumulation. The Checkpoint mechanism allows pausing and resuming execution at any node, which is critical for long-running Agents and human-in-the-loop scenarios.

Compared to LangChain's AgentExecutor, LangGraph offers finer-grained control: you can precisely define conditions for each state transition, insert human approval nodes, and implement complex topologies for multi-Agent collaboration. The following example builds a ReAct Agent with tool-calling capabilities:

```python
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def search_web(query: str) -> str:
    """Search the web for real-time information"""
    return f"Search results: latest info about {query}..."

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
result = app.invoke({"messages": [("user", "What's the weather in Beijing today?")]})
print(result["messages"][-1].content)
```

The execution flow: user input → agent node invokes LLM → if LLM decides to call a tool, route to tools node → after tool execution, return to agent node for continued reasoning → until LLM produces a final answer.
