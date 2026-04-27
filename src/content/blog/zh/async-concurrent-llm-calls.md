---
title: "异步与并发调用 LLM"
date: "2026-03-27"
description: "使用 asyncio 和并发模式高效调用 LLM API，提升批量推理吞吐量"
tags: [异步, asyncio, 并发]
---

在批量处理场景中（如对数百篇文档生成摘要、批量分类），串行调用 LLM API 效率极低。LLM API 调用是典型的 I/O 密集型操作，非常适合用异步并发来提升吞吐量。

**asyncio + async/await** 是 Python 异步编程的基础。OpenAI 等 SDK 都提供了异步客户端（`AsyncOpenAI`），配合 `asyncio.gather` 或 `asyncio.Semaphore` 可以实现高并发调用。关键是用信号量控制并发数，避免触发 API 速率限制（Rate Limit）。

**并发策略选择：** `asyncio.gather` 适合任务数量已知且较少的场景；`asyncio.as_completed` 适合需要逐个处理结果的场景；`asyncio.TaskGroup`（Python 3.11+）提供更好的错误处理——任一任务失败会取消其余任务。对于超大批量任务，建议使用 `asyncio.Queue` 实现生产者-消费者模式。

速率限制处理是生产环境的核心挑战。除了信号量控制并发数，还需实现指数退避重试（Exponential Backoff）。OpenAI 的速率限制分为 RPM（每分钟请求数）和 TPM（每分钟 token 数），需要同时控制两个维度。

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()
semaphore = asyncio.Semaphore(10)  # 最多 10 个并发请求

async def summarize(text: str, idx: int) -> dict:
    async with semaphore:
        for attempt in range(3):
            try:
                resp = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": f"用一句话总结：\n{text}"}],
                )
                return {"idx": idx, "summary": resp.choices[0].message.content}
            except Exception as e:
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    return {"idx": idx, "error": str(e)}

async def batch_summarize(texts: list[str]) -> list[dict]:
    tasks = [summarize(t, i) for i, t in enumerate(texts)]
    return await asyncio.gather(*tasks)

texts = [f"这是第 {i} 篇文档的内容..." for i in range(100)]
results = asyncio.run(batch_summarize(texts))
print(f"完成 {len(results)} 篇，成功 {sum(1 for r in results if 'summary' in r)} 篇")
```

对于更复杂的场景，可结合 `aiohttp` 直接调用 REST API，或使用 `tenacity` 库实现更灵活的重试策略。
