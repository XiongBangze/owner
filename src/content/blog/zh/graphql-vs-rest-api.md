---
title: "GraphQL vs REST API 对比"
date: "2026-03-04"
description: "从查询灵活性、性能、缓存策略等维度对比 GraphQL 与 REST，帮助你在项目中做出合理选型。"
tags: ["GraphQL", "REST", "API设计"]
---

REST 和 GraphQL 是两种主流的 API 设计范式。REST 以资源为中心，通过 HTTP 动词（GET/POST/PUT/DELETE）操作固定端点；GraphQL 则提供单一端点，由客户端声明所需数据的形状。

REST 的优势在于简单直观、HTTP 缓存天然友好、生态成熟。但在复杂前端场景下，REST 容易出现"过度获取"（Over-fetching）和"获取不足"（Under-fetching）问题——一个页面可能需要调用多个端点才能拼凑出完整数据。GraphQL 通过声明式查询一次性获取精确数据，显著减少网络往返。

然而 GraphQL 也有代价：查询复杂度不可控可能导致 N+1 问题；HTTP 缓存失效（所有请求都是 POST）；需要额外的查询深度限制和复杂度分析来防止恶意查询。在实践中，对外公开 API 更适合 REST（标准化、可缓存），内部 BFF（Backend for Frontend）层更适合 GraphQL（灵活聚合）。

以下示例使用 Strawberry 构建一个简单的 GraphQL 服务，并与等价的 REST 端点对比：

```python
# === GraphQL (Strawberry + FastAPI) ===
import strawberry
from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter

@strawberry.type
class User:
    id: int
    name: str
    email: str

users_db = [
    User(id=1, name="Alice", email="alice@example.com"),
    User(id=2, name="Bob", email="bob@example.com"),
]

@strawberry.type
class Query:
    @strawberry.field
    def users(self) -> list[User]:
        return users_db

    @strawberry.field
    def user(self, id: int) -> User | None:
        return next((u for u in users_db if u.id == id), None)

app = FastAPI()
app.include_router(GraphQLRouter(strawberry.Schema(Query)), prefix="/graphql")

# === 等价 REST 端点 ===
@app.get("/api/users")
def rest_get_users():
    return [{"id": u.id, "name": u.name, "email": u.email} for u in users_db]

@app.get("/api/users/{user_id}")
def rest_get_user(user_id: int):
    user = next((u for u in users_db if u.id == user_id), None)
    return {"id": user.id, "name": user.name, "email": user.email} if user else {}
```

GraphQL 查询 `{ user(id: 1) { name } }` 只返回 `name` 字段，而 REST `/api/users/1` 始终返回全部字段。选型时应根据团队能力、客户端多样性和缓存需求综合权衡。
