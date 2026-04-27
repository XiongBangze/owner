---
title: "从单体到微服务的演进"
date: "2026-02-24"
description: "系统讲解从单体架构向微服务演进的策略，包括绞杀者模式、领域边界划分和渐进式拆分实践。"
tags: ["微服务", "架构演进", "重构"]
---

微服务不是银弹，盲目拆分单体往往带来更大的复杂度。正确的演进路径是：先让单体架构模块化，再根据业务需要逐步拆分。绞杀者模式（Strangler Fig Pattern）是最安全的迁移策略——在单体外部构建新服务，通过 API 网关逐步将流量从旧模块切换到新服务，直到单体被完全替代。

拆分的第一步是识别领域边界。使用领域驱动设计（DDD）中的限界上下文（Bounded Context）划分服务边界：每个微服务对应一个独立的业务领域，拥有自己的数据存储，通过 API 或事件与其他服务通信。常见的拆分信号包括：团队独立交付需求、不同的扩展需求、不同的技术栈需求、以及变更频率差异大的模块。

渐进式拆分的关键实践包括：先拆分无状态服务（如通知、文件处理）；使用反腐层（Anti-Corruption Layer）隔离新旧系统的数据模型；数据库拆分采用"先逻辑分离，再物理分离"策略；引入 API 网关统一入口，屏蔽内部服务拓扑变化。

以下示例展示使用 API 网关实现绞杀者模式的路由切换：

```python
from fastapi import FastAPI, Request
import httpx

app = FastAPI(title="API Gateway")

# 路由配置：定义哪些路径走新服务，哪些仍走单体
ROUTE_TABLE = {
    "/api/orders": "http://order-service:8001",      # 已拆分
    "/api/notifications": "http://notif-service:8002", # 已拆分
    "/api/users": "http://monolith:8000",              # 仍在单体
    "/api/products": "http://monolith:8000",           # 仍在单体
}

def resolve_upstream(path: str) -> str:
    for prefix, upstream in ROUTE_TABLE.items():
        if path.startswith(prefix):
            return upstream
    return "http://monolith:8000"  # 默认回退到单体

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def gateway_proxy(path: str, request: Request):
    upstream = resolve_upstream(f"/{path}")
    url = f"{upstream}/{path}"
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method=request.method,
            url=url,
            headers={k: v for k, v in request.headers.items() if k != "host"},
            content=await request.body(),
        )
    return resp.json()

# 健康检查：验证所有上游服务可用
@app.get("/health")
async def health_check():
    results = {}
    async with httpx.AsyncClient(timeout=2.0) as client:
        for name, url in ROUTE_TABLE.items():
            try:
                r = await client.get(f"{url}/health")
                results[name] = "healthy" if r.status_code == 200 else "degraded"
            except httpx.RequestError:
                results[name] = "unreachable"
    return results
```

迁移过程中最重要的是保持系统始终可用。每次拆分一个服务，验证稳定后再拆下一个，避免"大爆炸"式重写。
