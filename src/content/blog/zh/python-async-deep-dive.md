---
title: "Python 异步编程深入"
date: "2026-03-15"
description: "深入探讨 Python asyncio 的事件循环、协程调度与并发模式，掌握高性能异步编程的核心技巧。"
tags: ["asyncio", "异步", "Python"]
---

Python 的 `asyncio` 模块是构建高并发 I/O 密集型应用的核心工具。与多线程不同，asyncio 基于单线程事件循环，通过协程（coroutine）在 I/O 等待期间主动让出控制权，从而实现高效的并发调度。

事件循环是 asyncio 的心脏。它不断地从任务队列中取出就绪的协程执行，当协程遇到 `await` 表达式时挂起，将控制权交还给事件循环。这种协作式调度避免了线程切换的开销和锁竞争问题。

`asyncio.gather` 和 `asyncio.create_task` 是两种常见的并发模式。`gather` 适合同时等待多个协程的结果，而 `create_task` 则将协程包装为 Task 对象，使其在后台调度执行。对于需要限制并发数的场景，`asyncio.Semaphore` 是不可或缺的工具——它能防止同时发起过多请求导致资源耗尽。

在实际生产中，合理使用 `asyncio.wait_for` 设置超时、通过 `asyncio.shield` 保护关键任务不被取消，以及利用 `async for` 处理异步迭代器，都是提升系统健壮性的关键手段。理解 asyncio 的底层调度机制，才能写出真正高效的异步代码。

```python
import asyncio
import aiohttp

async def fetch(session, url, sem):
    async with sem:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            return await resp.json()

async def main():
    urls = [f"https://api.example.com/data/{i}" for i in range(100)]
    sem = asyncio.Semaphore(20)  # 限制并发数为20

    async with aiohttp.ClientSession() as session:
        tasks = [asyncio.create_task(fetch(session, url, sem)) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    success = [r for r in results if not isinstance(r, Exception)]
    errors = [r for r in results if isinstance(r, Exception)]
    print(f"成功: {len(success)}, 失败: {len(errors)}")

asyncio.run(main())
```
