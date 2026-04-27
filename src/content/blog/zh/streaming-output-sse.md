---
title: "流式输出与 SSE 实现"
date: "2026-04-04"
description: "使用 FastAPI 和 Server-Sent Events 实现大模型流式输出，提升用户体验与首字延迟"
tags: [Streaming, SSE, FastAPI]
---

在与大语言模型交互时，等待完整响应生成往往需要数秒甚至更长。流式输出（Streaming）通过逐 token 返回结果，让用户在生成过程中即可看到内容，显著降低感知延迟。Server-Sent Events（SSE）是实现流式输出最轻量的方案——它基于 HTTP 长连接，服务端单向推送，客户端通过 `EventSource` API 接收，无需 WebSocket 的双向握手开销。

在 FastAPI 中，`StreamingResponse` 配合异步生成器即可实现 SSE。核心思路是：将 LLM 的流式回调包装为 `async generator`，每产出一个 chunk 就按 SSE 协议格式（`data: ...\n\n`）发送。需要注意以下关键点：设置 `Content-Type` 为 `text/event-stream`；禁用代理缓冲（`X-Accel-Buffering: no`）；在流结束时发送 `[DONE]` 标记以便前端关闭连接。对于生产环境，还应考虑心跳机制防止连接超时、错误处理中断流、以及通过 `retry` 字段控制客户端重连间隔。

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

app = FastAPI()
client = AsyncOpenAI()

async def generate_stream(prompt: str):
    stream = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield f"data: {delta}\n\n"
    yield "data: [DONE]\n\n"

@app.get("/chat/stream")
async def chat_stream(prompt: str):
    return StreamingResponse(
        generate_stream(prompt),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no"},
    )
```

该方案在 Nginx 反向代理后需额外配置 `proxy_buffering off`，确保 chunk 不被缓冲聚合。
