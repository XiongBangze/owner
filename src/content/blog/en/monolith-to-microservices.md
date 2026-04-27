---
title: "From Monolith to Microservices"
date: "2026-02-24"
description: "A systematic guide to evolving from monolithic to microservices architecture, covering the Strangler Fig pattern, domain boundary identification, and incremental decomposition."
tags: ["Microservices", "Architecture Evolution", "Refactoring"]
---

Microservices are not a silver bullet — blindly splitting a monolith often introduces greater complexity. The correct evolution path is: first modularize the monolith, then gradually decompose based on business needs. The Strangler Fig Pattern is the safest migration strategy — build new services outside the monolith, use an API gateway to incrementally route traffic from old modules to new services, until the monolith is fully replaced.

The first step in decomposition is identifying domain boundaries. Use Bounded Contexts from Domain-Driven Design (DDD) to define service boundaries: each microservice corresponds to an independent business domain, owns its data store, and communicates with other services via APIs or events. Common signals for splitting include: independent team delivery needs, different scaling requirements, different technology stack needs, and modules with vastly different change frequencies.

Key practices for incremental decomposition include: start by extracting stateless services (notifications, file processing); use an Anti-Corruption Layer to isolate data models between old and new systems; adopt a "logical separation first, physical separation later" strategy for database splitting; and introduce an API gateway as a unified entry point to shield internal service topology changes.

The following example demonstrates route switching with the Strangler Fig pattern using an API gateway:

```python
from fastapi import FastAPI, Request
import httpx

app = FastAPI(title="API Gateway")

# Route config: which paths go to new services, which still hit the monolith
ROUTE_TABLE = {
    "/api/orders": "http://order-service:8001",      # Extracted
    "/api/notifications": "http://notif-service:8002", # Extracted
    "/api/users": "http://monolith:8000",              # Still in monolith
    "/api/products": "http://monolith:8000",           # Still in monolith
}

def resolve_upstream(path: str) -> str:
    for prefix, upstream in ROUTE_TABLE.items():
        if path.startswith(prefix):
            return upstream
    return "http://monolith:8000"  # Default fallback to monolith

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

# Health check: verify all upstream services are available
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

The most important thing during migration is keeping the system available at all times. Extract one service at a time, verify stability, then move to the next — avoid "big bang" rewrites.
