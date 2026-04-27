---
title: "接口幂等性设计"
date: "2026-03-07"
description: "系统讲解 API 幂等性的设计原则与实现方案，包括幂等键、Token 机制和数据库唯一约束，保障分布式系统的数据一致性。"
tags: ["幂等性", "API设计", "后端"]
---

幂等性（Idempotency）是指同一操作执行一次和执行多次产生的效果相同。在分布式系统中，网络超时、客户端重试、消息重复投递等场景使得幂等性设计成为 API 可靠性的基石。

**HTTP 方法的天然幂等性**：GET、PUT、DELETE 在语义上是幂等的（PUT 用完整数据覆盖资源，DELETE 删除已不存在的资源返回 404），而 POST 天然非幂等（每次调用可能创建新资源）。因此，POST 接口的幂等性需要额外设计。

**幂等键（Idempotency Key）** 是最通用的方案：客户端在请求头中携带唯一标识（如 `Idempotency-Key: uuid`），服务端以此为键缓存处理结果。相同 key 的重复请求直接返回缓存结果，不再执行业务逻辑。Stripe、PayPal 等支付平台均采用此方案。

**Token 机制**适用于表单防重复提交：服务端预先下发 Token，客户端提交时携带 Token，服务端验证并消费 Token（原子操作），重复提交因 Token 已消费而被拒绝。

**数据库唯一约束**是最底层的保障：通过业务唯一键（如订单号+操作类型）建立唯一索引，重复插入触发冲突而非创建重复数据。

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

            # 检查是否已处理
            cached = r.get(cache_key)
            if cached:
                return json.loads(cached)

            # 用 SET NX 防止并发重复执行
            if not r.set(f"{cache_key}:lock", "1", nx=True, ex=30):
                raise Exception("请求正在处理中，请稍后重试")

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
