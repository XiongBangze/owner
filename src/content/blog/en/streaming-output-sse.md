---
title: "Streaming Output with SSE"
date: "2026-04-04"
description: "Implement LLM streaming output using FastAPI and Server-Sent Events to improve user experience and time-to-first-token"
tags: [Streaming, SSE, FastAPI]
---

When interacting with large language models, waiting for the full response can take seconds or longer. Streaming output returns tokens incrementally, allowing users to see content as it's generated and significantly reducing perceived latency. Server-Sent Events (SSE) is the lightest approach for streaming — it uses a long-lived HTTP connection with server-to-client push, and the client receives data via the `EventSource` API without the bidirectional handshake overhead of WebSocket.

In FastAPI, `StreamingResponse` combined with an async generator implements SSE elegantly. The core idea is to wrap the LLM's streaming callback into an `async generator` that yields each chunk in SSE protocol format (`data: ...\n\n`). Key considerations include: setting `Content-Type` to `text/event-stream`; disabling proxy buffering (`X-Accel-Buffering: no`); and sending a `[DONE]` marker at the end so the frontend can close the connection. For production, you should also implement heartbeat mechanisms to prevent connection timeouts, handle errors that interrupt the stream, and use the `retry` field to control client reconnection intervals.

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

When behind an Nginx reverse proxy, you'll also need to configure `proxy_buffering off` to prevent chunks from being buffered and aggregated.
