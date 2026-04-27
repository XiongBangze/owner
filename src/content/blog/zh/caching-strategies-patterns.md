---
title: "缓存策略与模式"
date: "2026-03-13"
description: "系统梳理 Cache-Aside、Write-Through、Write-Behind 等缓存模式，结合 Redis 实践解决缓存穿透、击穿与雪崩问题。"
tags: ["缓存", "Redis", "策略"]
---

缓存是提升系统性能最直接有效的手段，但错误的缓存策略会引发数据不一致、缓存穿透、缓存击穿和缓存雪崩等严重问题。

**Cache-Aside（旁路缓存）** 是最常用的模式：读请求先查缓存，未命中则查数据库并回填缓存；写请求先更新数据库，再删除缓存。这种模式简单可靠，但存在短暂的数据不一致窗口。

**Write-Through（直写）** 模式下，写操作同时更新缓存和数据库，保证强一致性，但写入延迟较高。**Write-Behind（异步写回）** 则先更新缓存，异步批量写入数据库，吞吐量高但有数据丢失风险。

缓存穿透指查询不存在的数据导致请求直达数据库。解决方案包括布隆过滤器（Bloom Filter）拦截无效请求，或缓存空值并设置短过期时间。缓存击穿是热点 key 过期瞬间大量请求涌入数据库，可通过互斥锁或逻辑过期解决。缓存雪崩则是大量 key 同时过期，需要通过随机化过期时间来分散失效。

在实际项目中，合理设置 TTL、使用多级缓存（本地缓存 + Redis）、以及监控缓存命中率，是保障缓存系统稳定运行的关键。

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

    user = db_query_user(user_id)  # 查询数据库
    if user:
        ttl = 3600 + random.randint(0, 300)  # 随机化TTL防雪崩
        r.setex(cache_key, ttl, json.dumps(user))
    else:
        r.setex(cache_key, 60, "NULL")  # 缓存空值防穿透
    return user

def update_user(user_id: str, data: dict):
    db_update_user(user_id, data)  # 先更新数据库
    r.delete(f"user:{user_id}")    # 再删除缓存
```
