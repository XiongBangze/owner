---
title: "Distributed Lock Implementation"
date: "2026-03-08"
description: "Implementing distributed locks with Redis, analyzing SET NX EX and Redlock algorithm principles and pitfalls, with production-grade Python code."
tags: ["distributed lock", "Redis", "Python"]
---

In distributed systems, when multiple processes or service instances need mutually exclusive access to shared resources, distributed locks are an essential coordination mechanism. Redis, with its high performance and atomic operations, is the go-to solution.

**Basic implementation** uses the `SET key value NX EX` command: NX ensures only one client can acquire the lock, EX sets an expiration to prevent deadlocks. The value must be a unique identifier (e.g., UUID), and lock release must atomically compare-and-delete via a Lua script to avoid accidentally releasing another client's lock.

**Common pitfalls** include: lock expiring before business logic completes (requires a watchdog mechanism for automatic renewal), lock loss during Redis master-slave failover (the replica may not have synced the lock data), and non-atomic release operations (GET then DEL has a race condition).

**Redlock algorithm** is a multi-node distributed lock scheme proposed by Redis's author: request locks from N independent Redis instances simultaneously, and consider the lock acquired only when more than half (N/2+1) succeed and total elapsed time is less than the lock's validity period. This improves fault tolerance but adds complexity and latency.

Production recommendations: prefer mature libraries (e.g., python-redis-lock), set reasonable lock timeouts and retry strategies, and combine with business-layer idempotency as a safety net.

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

    # Lua script for atomic release
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
            raise TimeoutError(f"Failed to acquire lock: {self.key}")
        return self

    def __exit__(self, *args):
        self.release()

# Usage
r = redis.Redis()
with RedisLock(r, "order:1001") as lock:
    print("Lock acquired, executing critical operation...")
```
