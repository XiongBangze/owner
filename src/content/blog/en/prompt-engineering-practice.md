---
title: "Prompt Engineering in Practice: Writing High-Quality Prompts"
date: "2026-04-15"
description: "Systematic prompt design methodology with advanced patterns and Python examples."
tags: ["Prompt Engineering", "LLM", "AI Agent", "Python"]
---

## Why Prompts Matter

The same model can produce vastly different outputs depending on the prompt. Prompt Engineering is a reproducible engineering discipline.

## Fundamental Principles

### 1. Define a Role

```python
# ❌ Vague
messages = [{"role": "user", "content": "Write some code for me"}]

# ✅ Clear role
messages = [
    {"role": "system", "content": "You are a senior Python backend engineer with expertise in FastAPI and distributed systems."},
    {"role": "user", "content": "Write a rate-limited API endpoint"}
]
```

### 2. Be Specific

```python
# ❌ Vague
prompt = "Optimize this code"

# ✅ Specific
prompt = """Optimize the following Python code for performance, focusing on:
1. Reducing database queries (current N+1 problem)
2. Adding appropriate caching
3. Maintaining readability
Do not change function signatures or return value formats."""
```

### 3. Provide Examples (Few-shot)

```python
prompt = """Classify error logs as: [database_error, network_error, logic_error, unknown]

Examples:
Input: psycopg2.OperationalError: connection refused
Output: database_error

Input: requests.exceptions.ReadTimeout: Read timed out
Output: network_error

Now classify:
Input: KeyError: 'user_id' in process_order()
Output:"""
```

### 4. Specify Output Format

```python
prompt = """Analyze the API performance bottlenecks. Output as JSON:
{
  "bottlenecks": [{"location": "...", "issue": "...", "suggestion": "..."}],
  "priority": "high|medium|low",
  "estimated_improvement": "..."
}
Output JSON only, nothing else."""
```

## Advanced Patterns

### Chain of Thought

Force step-by-step reasoning:

```python
prompt = """Analyze the data consistency issue in this distributed system. Think step by step:

1. First, identify the services and data flows involved
2. Then analyze possible failure scenarios
3. Assess the blast radius of each scenario
4. Finally, propose solutions

System:
Order service calls inventory service to deduct stock, then calls payment service.
Inventory and payment each have independent databases.
No distributed transactions are currently used."""
```

### ReAct Pattern

The core prompt pattern for AI Agents:

```python
system_prompt = """You are an intelligent assistant with these tools:
- search_database(query): Search the database
- call_api(url, params): Call external APIs
- send_notification(user, message): Send notifications

For each request, follow this pattern:
Thought: Analyze the situation, decide next step
Action: Choose and invoke a tool
Observation: Observe the tool's result
... (repeat until done)
Answer: Provide the final response"""
```

### Structured Output

Parse LLM output into typed objects:

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
        {"role": "system", "content": "You are a code review expert. Output structured results."},
        {"role": "user", "content": f"Review this code:\n{code}"}
    ],
    response_format=CodeReviewResult,
)

result = response.choices[0].message.parsed
print(f"[{result.severity}] {result.description}")
```

## Practical Prompt Templates

### SQL Generation

```python
sql_prompt = """You are a SQL expert. Generate PostgreSQL queries from natural language.

Schema:
- orders(id, user_id, amount, status, created_at)
- users(id, name, email, created_at)
- products(id, name, price, category)
- order_items(id, order_id, product_id, quantity)

Rules:
1. Only SELECT statements, never INSERT/UPDATE/DELETE
2. Use parameterized queries (%s placeholders)
3. Always include LIMIT for large tables
4. Output pure SQL only, no explanations

User request: {question}"""
```

### Log Analysis

```python
log_prompt = """Analyze the following application logs for anomalies.

Focus on:
1. Abnormal error rate spikes
2. Signs of cascading failures
3. Response time anomalies

Output:
- Summary (one sentence)
- Root cause analysis
- Blast radius
- Recommended actions

Logs:
{logs}"""
```

### Code Review

```python
review_prompt = """As a senior Python engineer, review this code.

Dimensions:
1. Security (SQL injection, XSS, data leaks)
2. Performance (N+1 queries, memory leaks, unnecessary allocations)
3. Maintainability (naming, SRP, error handling)
4. Concurrency (race conditions, deadlock risks)

Mark each issue: 🔴 Critical 🟡 Warning 🔵 Suggestion

Code:
```python
{code}
```"""
```

## Prompt Management Best Practices

### 1. Template Files

```python
from pathlib import Path
from string import Template

def load_prompt(name: str, **kwargs) -> str:
    template = Path(f"prompts/{name}.txt").read_text()
    return Template(template).safe_substitute(**kwargs)

prompt = load_prompt("sql_generator", question="Get total order amount per user")
```

### 2. LangChain PromptTemplate

```python
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

template = ChatPromptTemplate.from_messages([
    ("system", "Answer based on the following context.\nContext: {context}"),
    ("human", "{question}"),
])

chain = template | llm | StrOutputParser()
answer = chain.invoke({"context": retrieved_docs, "question": user_question})
```

### 3. Testing

```python
import pytest

def test_sql_generator_handles_join():
    result = ai_service.generate_sql("Get total order amount per user")
    assert "JOIN" in result.upper()
    assert "SUM" in result.upper()
    assert "DELETE" not in result.upper()

def test_sql_generator_adds_limit():
    result = ai_service.generate_sql("Get all users")
    assert "LIMIT" in result.upper()
```

## Common Pitfalls

1. **Prompt too long**: Context window is limited — put key info first
2. **Conflicting instructions**: Multiple constraints that contradict each other
3. **Over-reliance on prompts**: Complex logic belongs in code, not prompts
4. **Ignoring security**: User input may contain prompt injection — always sanitize

Good prompts aren't written once — they're continuously tested and iteratively refined.
