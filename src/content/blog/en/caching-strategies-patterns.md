---
title: "Caching Strategies and Patterns"
date: "2026-03-13"
description: "A systematic overview of Cache-Aside, Write-Through, and Write-Behind patterns, with Redis practices for solving cache penetration, breakdown, and avalanche."
tags: ["caching", "Redis", "strategies"]
---

Caching is the most direct and effective way to boost system performance, but incorrect caching strategies can cause serious issues like data inconsistency, cache penetration, cache breakdown, and cache avalanche.

**Cache-Aside** is the most common pattern: read requests check the cache first, query the database on miss and backfill the cache; write requests update the database first, then delete the cache. This pattern is simple and reliable but has a brief data inconsistency window.

**Write-Through** updates both cache and database simultaneously on writes, ensuring strong consistency but with higher write latency. **Write-Behind** updates the cache first and asynchronously batch-writes to the database, offering high throughput but risking data loss.

Cache penetration occurs when queries for non-existent data hit the database directly. Solutions include Bloom Filters to intercept invalid requests, or caching null values with short TTLs. Cache breakdown happens when a hot key expires and massive requests flood the database — solved via mutex locks or logical expiration. Cache avalanche is when many keys expire simultaneously, mitigated by randomizing expiration times.

In production, properly setting TTLs, using multi-level caching (local cache + Redis), and monitoring cache hit rates are essential for stable cache system operation.

```python
import redis
import json
import random

r = redis.Redis(decode_responses=True)

def get_user(user_id: str) -> dict | None:
    cache_key = f"user:{user_id}"
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached) if cached != "NULL" else None

    user = db_query_user(user_id)  # Query database
    if user:
        ttl = 3600 + random.randint(0, 300)  # Randomize TTL to prevent avalanche
        r.setex(cache_key, ttl, json.dumps(user))
    else:
        r.setex(cache_key, 60, "NULL")  # Cache null to prevent penetration
    return user

def update_user(user_id: str, data: dict):
    db_update_user(user_id, data)  # Update database first
    r.delete(f"user:{user_id}")    # Then delete cache
```
