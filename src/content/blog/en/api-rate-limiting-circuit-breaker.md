---
title: "API Rate Limiting and Circuit Breaking"
date: "2026-03-20"
description: "Implement API rate limiting and circuit breaker patterns to protect AI backend services from traffic spikes and cascading failures."
tags: ["Rate Limiting", "Circuit Breaker", "High Availability"]
---

AI inference services are computationally expensive with long response times. When traffic exceeds capacity, the entire system can cascade into failure. Rate limiting and circuit breaking are two critical defenses for service availability.

## Rate Limiting Strategies

Common rate limiting algorithms include fixed window, sliding window, token bucket, and leaky bucket. For AI APIs, the sliding window algorithm is recommended — it's smoother than fixed windows and avoids burst traffic at window boundaries. Redis-based distributed rate limiting maintains consistency across multi-instance deployments. Rate limits can be applied per user, API key, or IP, with different tiers receiving different quotas.

## Circuit Breaker Pattern

When downstream model services fail, continuous retries only worsen the problem. The Circuit Breaker pattern automatically cuts off requests when the error rate exceeds a threshold, entering an "open" state that returns degraded responses. After a cooldown period, it enters a "half-open" state, allowing a few probe requests to test recovery. This mechanism effectively prevents cascading failures from spreading across microservice architectures.

## Degradation Strategies

When rate limiting or circuit breaking triggers, the system should not simply return errors. Instead, provide degraded responses: return cached results, use a lightweight fallback model, or return preset default answers. Good degradation strategies let users perceive reduced quality rather than total unavailability.

```python
import time
import asyncio
from enum import Enum
from dataclasses import dataclass, field
import redis.asyncio as redis

# ---- Sliding Window Rate Limiter ----
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

# ---- Circuit Breaker ----
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
