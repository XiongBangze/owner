---
title: "构建 MCP 服务器"
date: "2026-03-29"
description: "使用 Python 构建 Model Context Protocol (MCP) 服务器，为 AI 助手提供工具调用能力"
tags: [MCP, Tool Server, Python]
---

Model Context Protocol（MCP）是 Anthropic 提出的开放协议，旨在标准化 AI 模型与外部工具/数据源的交互方式。MCP 服务器暴露一组工具（Tools）、资源（Resources）和提示模板（Prompts），AI 客户端通过 JSON-RPC 协议调用。这种架构将工具能力与模型解耦，一个 MCP 服务器可以同时服务多个 AI 客户端。

MCP 服务器的核心概念包括：**Tools** 是可执行的函数，接受参数并返回结果（如查询数据库、调用 API）；**Resources** 是只读数据源（如文件内容、配置信息）；**Prompts** 是预定义的提示模板。传输层支持 stdio（本地进程通信）和 SSE（远程 HTTP 通信）两种模式。

Python SDK `mcp` 提供了高层 API，用装饰器即可定义工具。每个工具需要清晰的名称、描述和参数 schema，因为 LLM 依赖这些元信息决定何时调用哪个工具。错误处理应返回结构化的错误信息而非抛出异常，以便 LLM 理解并重试。

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("demo-server", version="0.1.0")

@mcp.tool()
def query_database(sql: str) -> str:
    """Execute a read-only SQL query. Only SELECT allowed."""
    if not sql.strip().upper().startswith("SELECT"):
        return "Error: only SELECT queries are permitted"
    import sqlite3
    conn = sqlite3.connect("analytics.db")
    try:
        rows = conn.execute(sql).fetchall()
        return "\n".join(str(r) for r in rows[:50])
    finally:
        conn.close()

@mcp.tool()
def get_weather(city: str) -> str:
    """Get current weather for a given city name."""
    return f"{city}: 晴, 25°C, 湿度 60%"

@mcp.resource("config://app-settings")
def get_settings() -> str:
    """Return current application configuration."""
    return '{"model": "gpt-4o", "temperature": 0.7}'

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

部署时可通过 `uvx` 或 Docker 运行，客户端（如 Claude Desktop、Kiro）在配置文件中指定服务器地址即可连接。
