---
title: "分布式锁实现"
date: "2026-03-08"
description: "基于 Redis 实现分布式锁，深入分析 SET NX EX、Redlock 算法的原理与陷阱，提供生产级 Python 实现。"
tags: ["分布式锁", "Redis", "Python"]
---

在分布式系统中，多个进程或服务实例需要互斥访问共享资源时，分布式锁是必不可少的协调机制。Redis 凭借其高性能和原子操作特性，成为实现分布式锁的首选方案。

**基本实现**使用 `SET key value NX EX` 命令：NX 保证只有一个客户端能获取锁，EX 设置过期时间防止死锁。value 必须是唯一标识（如 UUID），释放锁时需要通过 Lua 脚本原子性地比较并删除，避免误删其他客户端的锁。

**常见陷阱**包括：锁过期但业务未完成（需要看门狗机制自动续期）、Redis 主从切换导致锁丢失（主节点宕机时从节点可能未同步到锁数据）、以及非原子性的释放操作（先 GET 再 DEL 存在竞态条件）。

**Redlock 算法**是 Redis 作者提出的多节点分布式锁方案：向 N 个独立 Redis 实例同时请求加锁，当超过半数（N/2+1）实例加锁成功且总耗时小于锁的有效期时，才认为加锁成功。这提高了容错性，但也增加了复杂度和延迟。

生产环境建议：优先使用成熟的库（如 python-redis-lock），设置合理的锁超时和重试策略，并配合业务层的幂等性设计作为兜底。

```python
import redis
import uuid
import time

class RedisLock:
    def __init__(self, client: redis.Redis, key: str, ttl: int = 10):
        self.client = client
        self.key = f"lock:{key}"
        self.token = str(uuid.uuid4())
        self.ttl = ttl

    # Lua脚本保证原子性释放
    _release_lua = """
    if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
    end
    return 0
    """

    def acquire(self, retry: int = 3, delay: float = 0.2) -> bool:
        for _ in range(retry):
            if self.client.set(self.key, self.token, nx=True, ex=self.ttl):
                return True
            time.sleep(delay)
        return False

    def release(self) -> bool:
        return self.client.eval(self._release_lua, 1, self.key, self.token) == 1

    def __enter__(self):
        if not self.acquire():
            raise TimeoutError(f"无法获取锁: {self.key}")
        return self

    def __exit__(self, *args):
        self.release()

# 使用示例
r = redis.Redis()
with RedisLock(r, "order:1001") as lock:
    print("已获取锁，执行关键操作...")
```
