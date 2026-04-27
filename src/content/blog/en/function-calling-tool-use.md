---
title: "Function Calling: Let LLMs Invoke Your APIs"
date: "2026-04-23"
description: "How Function Calling works, Python implementation patterns, and its role as the backbone of AI Agents."
tags: ["Function Calling", "AI Agent", "Python", "OpenAI"]
---

## What is Function Calling?

Function Calling transforms models from "chatbots" into systems that can **invoke external tools** to complete real tasks.

```
User: What's the weather in Shanghai today?
Model: [calls get_weather("Shanghai")] → gets real data → Shanghai is sunny, 25°C
```

## How It Works

```
1. Developer defines available function schemas (name, params, description)
2. User asks a question
3. Model decides whether to call a function, outputs function name + args (JSON)
4. Application layer executes the function
5. Result is returned to the model
6. Model generates final answer based on the result
```

## Using OpenAI's Native API

```python
import openai
import json

# 1. Define tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"},
                },
                "required": ["city"]
            }
        }
    }
]

# 2. Function implementations
def get_weather(city: str) -> str:
    return json.dumps({"city": city, "temp": "25°C", "condition": "Sunny"})

available_functions = {"get_weather": get_weather}

# 3. Call the model
client = openai.OpenAI()
messages = [{"role": "user", "content": "What's the weather in Shanghai?"}]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    tools=tools,
)

# 4. Handle tool calls
message = response.choices[0].message
if message.tool_calls:
    for tool_call in message.tool_calls:
        func_name = tool_call.function.name
        func_args = json.loads(tool_call.function.arguments)
        result = available_functions[func_name](**func_args)
        
        messages.append(message)
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": result,
        })
    
    # 5. Get final answer
    final = client.chat.completions.create(model="gpt-4o", messages=messages)
    print(final.choices[0].message.content)
```

## Simplified with LangChain

```python
from langchain.agents import tool, create_tool_calling_agent, AgentExecutor
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

@tool
def get_weather(city: str) -> str:
    """Get current weather for a city"""
    return f"{city}: Sunny, 25°C, Humidity 60%"

@tool
def query_orders(user_id: str) -> str:
    """Query orders by user ID"""
    return f"User {user_id} has 3 orders: ORD001(shipped), ORD002(pending), ORD003(completed)"

@tool
def track_logistics(order_id: str) -> str:
    """Track logistics by order ID"""
    return f"Order {order_id}: Arrived at Shanghai hub, expected delivery tomorrow"

@tool
def send_notification(user_id: str, message: str) -> str:
    """Send notification to a user"""
    return f"Notification sent to {user_id}: {message}"

llm = ChatOpenAI(model="gpt-4o", temperature=0)
tools = [get_weather, query_orders, track_logistics, send_notification]

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# Multi-tool orchestration: model auto-sequences the calls
result = executor.invoke({"input": "Check where my latest order is"})
```

## Design Principles

### Write Precise Descriptions

```python
# ❌ Vague
@tool
def process(data: str) -> str:
    """Process data"""
    ...

# ✅ Precise
@tool
def aggregate_monthly_sales(csv_data: str) -> str:
    """Aggregate CSV sales data by month, return monthly totals.
    Input should contain date and amount columns."""
    ...
```

### Handle Errors Gracefully

```python
@tool
def get_balance(user_id: str) -> str:
    """Query user account balance"""
    try:
        balance = account_service.get_balance(user_id)
        return f"User {user_id} balance: {balance:.2f}"
    except UserNotFoundError:
        return f"User {user_id} not found"  # Friendly message, not exception
```

### Enforce Security Boundaries

```python
@tool
def delete_order(order_id: str) -> str:
    """Delete an order (requires admin permission)"""
    if not current_user.has_permission("ORDER_DELETE"):
        return "Insufficient permissions for delete operation"
    order_service.soft_delete(order_id)
    return f"Order {order_id} deleted"
```

## Function Calling vs RAG

| Dimension | Function Calling | RAG |
|-----------|-----------------|-----|
| Purpose | Execute actions, get real-time data | Retrieve static knowledge |
| Data | Dynamic, real-time | Pre-indexed documents |
| Use cases | Weather, orders, notifications | Q&A, document search |

In production AI Agents, both are typically combined: RAG provides knowledge context, Function Calling executes actions.

## Takeaway

Function Calling is the "hands and feet" of AI Agents — transforming models from "talkers" into "doers". Mastering it is essential for building production-grade AI applications.
