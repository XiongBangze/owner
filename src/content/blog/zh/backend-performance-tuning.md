---
title: "后端性能调优"
date: "2026-03-02"
description: "从 Profiling 到实战优化，系统讲解 Python 后端性能瓶颈定位与调优策略。"
tags: ["性能", "优化", "Profiling"]
---

性能调优的第一原则是"先测量，再优化"。盲目优化不仅浪费时间，还可能引入新的复杂度。Python 后端的性能瓶颈通常集中在 I/O 等待（数据库查询、外部 API 调用）、CPU 密集计算和内存分配三个方面。

Profiling 是定位瓶颈的核心手段。`cProfile` 是 Python 内置的确定性分析器，能统计每个函数的调用次数和耗时。对于异步应用，`py-spy` 提供采样式分析，无需修改代码即可附加到运行中的进程。在 Web 场景下，应结合 APM 工具（如 OpenTelemetry）追踪请求全链路耗时，识别慢查询和慢依赖。

常见优化策略包括：数据库层面使用连接池、添加合适索引、避免 N+1 查询；应用层面引入缓存（Redis）减少重复计算；对 CPU 密集任务使用 `concurrent.futures` 或 Celery 异步执行；对热点数据结构选择更高效的实现（如用 `__slots__` 减少内存开销）。

以下示例展示如何使用 `cProfile` 定位瓶颈并用缓存优化：

```python
import cProfile
import functools
import time

# 模拟慢查询
def fetch_user_from_db(user_id: int) -> dict:
    time.sleep(0.1)  # 模拟 100ms 数据库查询
    return {"id": user_id, "name": f"User_{user_id}"}

# LRU 缓存优化
@functools.lru_cache(maxsize=256)
def fetch_user_cached(user_id: int) -> tuple:
    time.sleep(0.1)
    return (user_id, f"User_{user_id}")

def process_users(user_ids: list[int]):
    return [fetch_user_from_db(uid) for uid in user_ids]

def process_users_cached(user_ids: list[int]):
    return [fetch_user_cached(uid) for uid in user_ids]

# Profiling 对比
if __name__ == "__main__":
    ids = [1, 2, 3, 1, 2, 3, 1, 2, 3, 4]

    print("=== Without cache ===")
    cProfile.run("process_users(ids)")

    print("=== With LRU cache ===")
    cProfile.run("process_users_cached(ids)")
    # 缓存命中后，重复 ID 的查询耗时降为 0
```

性能优化是一个持续迭代的过程。建议在 CI 中集成基准测试（如 `pytest-benchmark`），确保每次变更不会引入性能回退。
