---
title: "Async and Concurrent LLM Calls"
date: "2026-03-27"
description: "Use asyncio and concurrency patterns to efficiently call LLM APIs and boost batch inference throughput"
tags: [Async, asyncio, Concurrency]
---

In batch processing scenarios (e.g., summarizing hundreds of documents, bulk classification), serial LLM API calls are extremely inefficient. LLM API calls are classic I/O-bound operations, making them ideal for async concurrency to boost throughput.

**asyncio + async/await** is the foundation of Python async programming. SDKs like OpenAI provide async clients (`AsyncOpenAI`), and combined with `asyncio.gather` or `asyncio.Semaphore`, you can achieve high-concurrency calls. The key is using semaphores to control concurrency and avoid triggering API rate limits.

**Concurrency strategy selection:** `asyncio.gather` suits scenarios with a known, small number of tasks; `asyncio.as_completed` suits scenarios where you need to process results one by one; `asyncio.TaskGroup` (Python 3.11+) provides better error handling — if any task fails, remaining tasks are cancelled. For very large batch jobs, use `asyncio.Queue` to implement a producer-consumer pattern.

Rate limit handling is the core production challenge. Beyond semaphore-based concurrency control, you need exponential backoff retries. OpenAI's rate limits include RPM (requests per minute) and TPM (tokens per minute), requiring control on both dimensions.

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()
semaphore = asyncio.Semaphore(10)  # Max 10 concurrent requests

async def summarize(text: str, idx: int) -> dict:
    async with semaphore:
        for attempt in range(3):
            try:
                resp = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": f"Summarize in one sentence:\n{text}"}],
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

texts = [f"Content of document {i}..." for i in range(100)]
results = asyncio.run(batch_summarize(texts))
print(f"Done {len(results)}, succeeded {sum(1 for r in results if 'summary' in r)}")
```

For more complex scenarios, combine `aiohttp` for direct REST API calls, or use the `tenacity` library for more flexible retry strategies.
