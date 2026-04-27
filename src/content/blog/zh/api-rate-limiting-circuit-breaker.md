---
title: "API 限流与熔断"
date: "2026-03-20"
description: "实现 API 限流和熔断机制，保护 AI 后端服务免受流量洪峰和级联故障的影响。"
tags: ["限流", "熔断", "高可用"]
---

AI 推理服务的计算成本高、响应时间长，一旦流量超过承载能力，整个系统可能雪崩。限流和熔断是保障服务高可用的两道关键防线。

## 限流策略

常见的限流算法包括固定窗口、滑动窗口、令牌桶和漏桶。对于 AI API，推荐使用滑动窗口算法——它比固定窗口更平滑，避免窗口边界的突发流量。基于 Redis 的分布式限流可以在多实例部署中保持一致性。限流维度可以按用户、API Key 或 IP 进行，不同等级的用户分配不同的配额。

## 熔断机制

当下游模型服务出现故障时，持续重试只会加剧问题。熔断器模式（Circuit Breaker）在错误率超过阈值时自动切断请求，进入"断开"状态返回降级响应。经过冷却期后进入"半开"状态，放行少量请求探测恢复情况。这种机制有效防止级联故障在微服务架构中扩散。

## 降级策略

限流或熔断触发后，不应简单返回错误，而应提供降级响应：返回缓存结果、使用轻量级备用模型、或返回预设的默认回答。良好的降级策略让用户感知到服务质量下降而非服务不可用。

```python
import time
import asyncio
from enum import Enum
from dataclasses import dataclass, field
import redis.asyncio as redis

# ---- 滑动窗口限流 ----
class SlidingWindowLimiter:
    def __init__(self, redis_client: redis.Redis, window_sec: int = 60, max_requests: int = 100):
        self.r = redis_client
        self.window = window_sec
        self.limit = max_requests

    async def is_allowed(self, key: str) -> bool:
        now = time.time()
        pipe = self.r.pipeline()
        pipe.zremrangebyscore(key, 0, now - self.window)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, self.window)
        results = await pipe.execute()
        return results[2] <= self.limit

# ---- 熔断器 ----
class State(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

@dataclass
class CircuitBreaker:
    failure_threshold: int = 5
    recovery_timeout: float = 30.0
    half_open_max: int = 3
    _state: State = State.CLOSED
    _failure_count: int = 0
    _last_failure_time: float = 0
    _half_open_calls: int = 0

    @property
    def state(self) -> State:
        if self._state == State.OPEN and time.time() - self._last_failure_time > self.recovery_timeout:
            self._state = State.HALF_OPEN
            self._half_open_calls = 0
        return self._state

    async def call(self, func, *args, fallback=None, **kwargs):
        if self.state == State.OPEN:
            return fallback() if fallback else None
        if self.state == State.HALF_OPEN and self._half_open_calls >= self.half_open_max:
            return fallback() if fallback else None
        try:
            self._half_open_calls += 1
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except Exception:
            self._on_failure()
            return fallback() if fallback else None

    def _on_success(self):
        self._failure_count = 0
        self._state = State.CLOSED

    def _on_failure(self):
        self._failure_count += 1
        self._last_failure_time = time.time()
        if self._failure_count >= self.failure_threshold:
            self._state = State.OPEN
```
