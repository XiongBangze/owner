---
title: "Function Calling：让大模型调用你的 API"
date: "2026-04-23"
description: "详解 Function Calling 的工作原理、Python 实现方式以及在 AI Agent 中的核心作用。"
tags: ["Function Calling", "AI Agent", "Python", "OpenAI"]
---

## 什么是 Function Calling？

Function Calling 让模型不再只是"聊天"，而是能够**调用外部工具**完成实际任务。

```
用户：今天上海天气怎么样？
模型：[调用 get_weather("上海")] → 获取真实数据 → 上海今天晴，25°C
```

## 工作原理

Function Calling 是一个**协商过程**：

```
1. 开发者定义可用函数的 schema（名称、参数、描述）
2. 用户提问
3. 模型判断是否需要调用函数，输出函数名和参数（JSON）
4. 应用层执行函数，获取结果
5. 将结果返回给模型
6. 模型基于结果生成最终回答
```

关键点：**模型只负责决定调用什么函数、传什么参数，实际执行由你的代码完成**。

## 使用 OpenAI 原生 API

```python
import openai
import json

# 1. 定义工具
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询指定城市的实时天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市名称"},
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_orders",
            "description": "根据用户ID查询订单列表",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "用户ID"},
                },
                "required": ["user_id"]
            }
        }
    }
]

# 2. 实际的函数实现
def get_weather(city: str) -> str:
    return json.dumps({"city": city, "temp": "25°C", "condition": "晴"})

def query_orders(user_id: str) -> str:
    return json.dumps({"orders": [{"id": "ORD001", "status": "已发货"}]})

available_functions = {
    "get_weather": get_weather,
    "query_orders": query_orders,
}

# 3. 调用模型
client = openai.OpenAI()
messages = [{"role": "user", "content": "上海天气怎么样？"}]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    tools=tools,
)

# 4. 处理工具调用
message = response.choices[0].message
if message.tool_calls:
    for tool_call in message.tool_calls:
        func_name = tool_call.function.name
        func_args = json.loads(tool_call.function.arguments)
        
        # 执行函数
        result = available_functions[func_name](**func_args)
        
        # 将结果返回给模型
        messages.append(message)
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": result,
        })
    
    # 5. 模型基于结果生成最终回答
    final_response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )
    print(final_response.choices[0].message.content)
```

## 使用 LangChain 简化

LangChain 的 `@tool` 装饰器大幅简化了流程：

```python
from langchain.agents import tool, create_tool_calling_agent, AgentExecutor
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

@tool
def get_weather(city: str) -> str:
    """查询指定城市的实时天气信息"""
    return f"{city}：晴，25°C，湿度 60%"

@tool
def query_orders(user_id: str) -> str:
    """根据用户ID查询订单列表"""
    return f"用户 {user_id} 有 3 个订单：ORD001(已发货), ORD002(待付款), ORD003(已完成)"

@tool
def track_logistics(order_id: str) -> str:
    """根据订单ID查询物流信息"""
    return f"订单 {order_id}：已到达上海转运中心，预计明天送达"

@tool
def send_notification(user_id: str, message: str) -> str:
    """发送通知消息给用户"""
    return f"已向用户 {user_id} 发送通知：{message}"

# 创建 Agent
llm = ChatOpenAI(model="gpt-4o", temperature=0)
tools = [get_weather, query_orders, track_logistics, send_notification]

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个智能助手，帮助用户处理各种任务。"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# 多工具协作：模型会自动编排调用顺序
result = executor.invoke({"input": "帮我查一下最近的订单到哪了"})
```

模型会自动：
1. 先调用 `query_orders` 获取订单列表
2. 再调用 `track_logistics` 查询最新订单的物流
3. 用自然语言组织回答

## 设计原则

### 函数描述要精确

```python
# ❌ 模糊的描述
@tool
def process(data: str) -> str:
    """处理数据"""
    ...

# ✅ 精确的描述
@tool
def aggregate_monthly_sales(csv_data: str) -> str:
    """将CSV格式的销售数据按月份汇总，返回每月销售总额。
    输入应包含 date 和 amount 两列。"""
    ...
```

### 做好错误处理

```python
@tool
def get_balance(user_id: str) -> str:
    """查询用户账户余额"""
    try:
        balance = account_service.get_balance(user_id)
        return f"用户 {user_id} 的余额为 {balance:.2f} 元"
    except UserNotFoundError:
        return f"未找到用户 {user_id}"  # 返回友好信息，不要抛异常
```

### 安全边界

```python
@tool
def delete_order(order_id: str) -> str:
    """删除指定订单（需要管理员权限）"""
    # 必须做权限校验！模型可能被 prompt injection 诱导调用危险操作
    if not current_user.has_permission("ORDER_DELETE"):
        return "权限不足，无法执行删除操作"
    order_service.soft_delete(order_id)
    return f"订单 {order_id} 已删除"
```

## Function Calling vs RAG

| 维度 | Function Calling | RAG |
|------|-----------------|-----|
| 用途 | 执行操作、获取实时数据 | 检索静态知识 |
| 数据 | 动态、实时 | 预索引的文档 |
| 典型场景 | 查天气、下单、发消息 | 问答、文档搜索 |

在实际的 AI Agent 中，两者通常组合使用：RAG 提供知识背景，Function Calling 执行具体操作。

## 总结

Function Calling 是 AI Agent 的"手和脚"——让模型从"只会说"变成"能做事"。掌握它，是构建生产级 AI 应用的必备技能。
