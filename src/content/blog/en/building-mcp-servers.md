---
title: "Building MCP Servers"
date: "2026-03-29"
description: "Build a Model Context Protocol (MCP) server in Python to give AI assistants tool-calling capabilities"
tags: [MCP, Tool Server, Python]
---

Model Context Protocol (MCP) is an open protocol proposed by Anthropic to standardize how AI models interact with external tools and data sources. An MCP server exposes a set of Tools, Resources, and Prompts, which AI clients invoke via JSON-RPC. This architecture decouples tool capabilities from models — a single MCP server can serve multiple AI clients simultaneously.

Core MCP concepts: **Tools** are executable functions that accept parameters and return results (e.g., querying databases, calling APIs); **Resources** are read-only data sources (e.g., file contents, configuration); **Prompts** are predefined prompt templates. The transport layer supports stdio (local process communication) and SSE (remote HTTP communication).

The Python SDK `mcp` provides a high-level API where decorators define tools. Each tool needs a clear name, description, and parameter schema, since the LLM relies on this metadata to decide when and which tool to call. Error handling should return structured error messages rather than raising exceptions, so the LLM can understand and retry.

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
    return f"{city}: Sunny, 25°C, Humidity 60%"

@mcp.resource("config://app-settings")
def get_settings() -> str:
    """Return current application configuration."""
    return '{"model": "gpt-4o", "temperature": 0.7}'

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

Deploy via `uvx` or Docker, and clients (Claude Desktop, Kiro, etc.) connect by specifying the server address in their configuration file.
