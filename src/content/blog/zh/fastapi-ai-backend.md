---
title: "FastAPI 构建 AI 后端"
date: "2026-03-24"
description: "使用 FastAPI 构建高性能 AI 推理后端，涵盖异步处理、流式响应和模型服务架构。"
tags: ["FastAPI", "REST API", "Python"]
---

FastAPI 凭借原生异步支持、自动 OpenAPI 文档和 Pydantic 数据校验，成为构建 AI 后端服务的理想框架。本文展示如何用 FastAPI 搭建一个生产级的 AI 推理服务。

## 异步推理架构

AI 模型推理通常是 I/O 密集型操作（调用远程 API 或 GPU 服务）。FastAPI 的 async/await 原生支持使得单个进程可以高效处理大量并发请求，避免线程阻塞。通过依赖注入管理模型客户端的生命周期，可以在应用启动时初始化连接池，在关闭时优雅释放资源。

## 流式响应（SSE）

大语言模型的生成过程是逐 token 输出的，使用 Server-Sent Events 可以将生成结果实时推送给客户端，显著改善用户感知延迟。FastAPI 的 `StreamingResponse` 配合异步生成器，可以优雅地实现这一模式。

## 请求校验与错误处理

Pydantic 模型不仅用于输入校验，还能作为 API 的契约文档。结合自定义异常处理器，可以统一错误响应格式，方便前端消费和运维排查。

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import asyncio
import httpx

class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4096)
    model: str = "gpt-4"
    temperature: float = Field(0.7, ge=0, le=2)
    stream: bool = False

class ChatResponse(BaseModel):
    text: str
    model: str
    usage: dict

ml_client: httpx.AsyncClient | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global ml_client
    ml_client = httpx.AsyncClient(base_url="http://model-server:8080", timeout=60)
    yield
    await ml_client.aclose()

app = FastAPI(title="AI Backend", lifespan=lifespan)

async def _stream_tokens(prompt: str):
    async with ml_client.stream("POST", "/generate", json={"prompt": prompt}) as resp:
        async for chunk in resp.aiter_lines():
            yield f"data: {chunk}\n\n"
    yield "data: [DONE]\n\n"

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if req.stream:
        return StreamingResponse(_stream_tokens(req.prompt), media_type="text/event-stream")
    resp = await ml_client.post("/generate", json={"prompt": req.prompt, "model": req.model})
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Model server error")
    data = resp.json()
    return ChatResponse(text=data["text"], model=req.model, usage=data["usage"])
```
