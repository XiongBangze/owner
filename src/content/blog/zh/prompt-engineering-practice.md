---
title: "Prompt Engineering 实战：写出高质量的提示词"
date: "2026-04-15"
description: "系统化的 Prompt 设计方法论，从基础技巧到高级模式，附大量 Python 实战示例。"
tags: ["Prompt Engineering", "LLM", "AI Agent", "Python"]
---

## Prompt 为什么重要？

同一个模型，不同的 Prompt 可以让输出质量天差地别。Prompt Engineering 不是"玄学"，而是一套可复现的工程方法。

## 基础原则

### 1. 明确角色

```python
# ❌ 模糊
messages = [{"role": "user", "content": "帮我写一段代码"}]

# ✅ 明确角色
messages = [
    {"role": "system", "content": "你是一个资深 Python 后端工程师，精通 FastAPI 和分布式系统。"},
    {"role": "user", "content": "帮我写一个带限流的 API 接口"}
]
```

### 2. 具体而非模糊

```python
# ❌ 模糊
prompt = "优化这段代码"

# ✅ 具体
prompt = """优化以下 Python 代码的性能，重点关注：
1. 减少数据库查询次数（当前有 N+1 问题）
2. 合理使用缓存
3. 保持代码可读性
不要改变函数签名和返回值格式。"""
```

### 3. 提供示例（Few-shot）

```python
prompt = """将以下错误日志分类为：[数据库错误, 网络错误, 业务逻辑错误, 未知错误]

示例：
输入：psycopg2.OperationalError: connection refused
输出：数据库错误

输入：requests.exceptions.ReadTimeout: Read timed out
输出：网络错误

现在分类：
输入：KeyError: 'user_id' in process_order()
输出："""
```

### 4. 指定输出格式

```python
prompt = """分析以下 API 的性能瓶颈，以 JSON 格式输出：
{
  "bottlenecks": [{"location": "...", "issue": "...", "suggestion": "..."}],
  "priority": "high|medium|low",
  "estimated_improvement": "..."
}
只输出 JSON，不要其他内容。"""
```

## 高级模式

### Chain of Thought（思维链）

让模型"一步步思考"，显著提升推理准确率：

```python
prompt = """分析以下分布式系统中的数据一致性问题，请一步步思考：

1. 首先识别涉及的服务和数据流
2. 然后分析可能的故障场景
3. 评估每个场景的影响范围
4. 最后给出解决方案

系统描述：
订单服务调用库存服务扣减库存，然后调用支付服务扣款。
库存服务和支付服务各自有独立的数据库。
当前没有使用分布式事务。"""
```

### ReAct 模式（推理+行动）

AI Agent 的核心 Prompt 模式：

```python
system_prompt = """你是一个智能助手，可以使用以下工具：
- search_database(query): 搜索数据库
- call_api(url, params): 调用外部 API
- send_notification(user, message): 发送通知

处理用户请求时，按以下模式思考和行动：
Thought: 分析当前情况，决定下一步
Action: 选择并调用工具
Observation: 观察工具返回结果
... (重复直到完成)
Answer: 给出最终回答"""
```

### 结构化输出

让 LLM 输出可解析的结构化数据：

```python
from pydantic import BaseModel
from openai import OpenAI

class CodeReviewResult(BaseModel):
    severity: str  # critical, major, minor, suggestion
    category: str  # security, performance, style, logic
    file: str
    line: int
    description: str
    fix: str

client = OpenAI()
response = client.beta.chat.completions.parse(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "你是代码审查专家，分析代码问题并输出结构化结果。"},
        {"role": "user", "content": f"审查以下代码：\n{code}"}
    ],
    response_format=CodeReviewResult,
)

result = response.choices[0].message.parsed
print(f"[{result.severity}] {result.description}")
```

## 实用 Prompt 模板

### SQL 生成

```python
sql_prompt = """你是一个 SQL 专家。根据用户的自然语言描述生成 PostgreSQL 查询语句。

数据库表结构：
- orders(id, user_id, amount, status, created_at)
- users(id, name, email, created_at)
- products(id, name, price, category)
- order_items(id, order_id, product_id, quantity)

规则：
1. 只生成 SELECT 语句，不允许 INSERT/UPDATE/DELETE
2. 必须使用参数化查询（用 %s 占位符）
3. 大表查询必须有 LIMIT
4. 输出纯 SQL，不要解释

用户描述：{question}"""
```

### 日志分析

```python
log_prompt = """分析以下应用日志，识别异常模式。

关注点：
1. 错误频率是否异常升高
2. 是否有级联故障的迹象
3. 响应时间是否有突变

输出格式：
- 问题摘要（一句话）
- 根因分析
- 影响范围
- 建议操作

日志内容：
{logs}"""
```

### 代码审查

```python
review_prompt = """作为资深 Python 工程师，审查以下代码。

审查维度：
1. 安全性（SQL注入、XSS、敏感信息泄露）
2. 性能（N+1查询、内存泄漏、不必要的对象创建）
3. 可维护性（命名、职责单一、异常处理）
4. 并发安全（竞态条件、死锁风险）

对每个问题标注严重级别：🔴 严重 🟡 警告 🔵 建议

代码：
```python
{code}
```"""
```

## Prompt 管理最佳实践

### 1. 模板化管理

```python
from pathlib import Path
from string import Template

# 将 Prompt 模板存为独立文件
def load_prompt(name: str, **kwargs) -> str:
    template = Path(f"prompts/{name}.txt").read_text()
    return Template(template).safe_substitute(**kwargs)

# 使用
prompt = load_prompt("sql_generator", question="查询每个用户的订单总金额")
```

### 2. 使用 LangChain PromptTemplate

```python
from langchain.prompts import ChatPromptTemplate

template = ChatPromptTemplate.from_messages([
    ("system", "基于以下上下文回答问题。\n上下文：{context}"),
    ("human", "{question}"),
])

chain = template | llm | StrOutputParser()
answer = chain.invoke({"context": retrieved_docs, "question": user_question})
```

### 3. 测试和评估

```python
import pytest

def test_sql_generator_handles_join():
    result = ai_service.generate_sql("查询每个用户的订单总金额")
    assert "JOIN" in result.upper()
    assert "SUM" in result.upper()
    assert "DELETE" not in result.upper()

def test_sql_generator_adds_limit():
    result = ai_service.generate_sql("查询所有用户")
    assert "LIMIT" in result.upper()
```

## 常见陷阱

1. **Prompt 过长**：上下文窗口有限，关键信息放前面
2. **指令冲突**：多个约束条件互相矛盾
3. **过度依赖 Prompt**：复杂逻辑应该用代码实现，不要全塞进 Prompt
4. **忽略安全**：用户输入可能包含 Prompt Injection，必须做输入清洗

Prompt Engineering 是 AI 应用开发的基本功。好的 Prompt 不是一次写成的，而是通过持续测试和迭代优化出来的。
