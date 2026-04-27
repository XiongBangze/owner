---
title: "API Idempotency Design"
date: "2026-03-07"
description: "A systematic guide to API idempotency design principles and implementation, including idempotency keys, token mechanisms, and database unique constraints."
tags: ["idempotency", "API design", "backend"]
---

Idempotency means that executing the same operation once or multiple times produces the same effect. In distributed systems, network timeouts, client retries, and duplicate message delivery make idempotency design a cornerstone of API reliability.

**Natural HTTP method idempotency**: GET, PUT, and DELETE are semantically idempotent (PUT overwrites a resource with complete data, DELETE on a non-existent resource returns 404), while POST is naturally non-idempotent (each call may create a new resource). Therefore, POST endpoints require explicit idempotency design.

**Idempotency Key** is the most universal approach: the client includes a unique identifier in the request header (e.g., `Idempotency-Key: uuid`), and the server caches the result using this key. Duplicate requests with the same key return the cached result without re-executing business logic. Payment platforms like Stripe and PayPal use this approach.

**Token mechanism** is suited for preventing duplicate form submissions: the server issues a token in advance, the client includes it on submission, and the server validates and consumes the token atomically. Duplicate submissions are rejected because the token has already been consumed.

**Database unique constraints** provide the lowest-level guarantee: a unique index on business keys (e.g., order_id + operation_type) causes duplicate inserts to trigger conflicts rather than creating duplicate data.

```python
import redis
import json
import functools

r = redis.Redis(decode_responses=True)

def idempotent(ttl: int = 3600):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(idempotency_key: str, *args, **kwargs):
            cache_key = f"idempotent:{func.__name__}:{idempotency_key}"

            # Check if already processed
            cached = r.get(cache_key)
            if cached:
                return json.loads(cached)

            # Use SET NX to prevent concurrent duplicate execution
            if not r.set(f"{cache_key}:lock", "1", nx=True, ex=30):
                raise Exception("Request is being processed, please retry later")

            try:
                result = func(*args, **kwargs)
                r.setex(cache_key, ttl, json.dumps(result))
                return result
            finally:
                r.delete(f"{cache_key}:lock")
        return wrapper
    return decorator

@idempotent(ttl=7200)
def create_order(user_id: str, product_id: str, amount: float) -> dict:
    order = {"user_id": user_id, "product_id": product_id, "amount": amount, "status": "created"}
    # db.orders.insert(order)
    return order
```
