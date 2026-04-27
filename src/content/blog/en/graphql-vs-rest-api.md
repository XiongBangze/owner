---
title: "GraphQL vs REST API"
date: "2026-03-04"
description: "Comparing GraphQL and REST across query flexibility, performance, and caching strategies to help you make the right choice."
tags: ["GraphQL", "REST", "API Design"]
---

REST and GraphQL are two dominant API design paradigms. REST is resource-centric, operating on fixed endpoints via HTTP verbs (GET/POST/PUT/DELETE). GraphQL exposes a single endpoint where the client declares the exact shape of the data it needs.

REST excels in simplicity, native HTTP caching support, and ecosystem maturity. However, in complex frontend scenarios, REST often suffers from over-fetching and under-fetching — a single page may require multiple endpoint calls to assemble complete data. GraphQL solves this with declarative queries that fetch precise data in a single round trip.

GraphQL comes with trade-offs, though: uncontrolled query complexity can cause N+1 problems; HTTP caching breaks down (all requests are POST); and you need query depth limits and complexity analysis to prevent malicious queries. In practice, public-facing APIs are better suited for REST (standardized, cacheable), while internal BFF (Backend for Frontend) layers benefit more from GraphQL (flexible aggregation).

The following example builds a simple GraphQL service with Strawberry and compares it with an equivalent REST endpoint:

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

# === Equivalent REST endpoints ===
@app.get("/api/users")
def rest_get_users():
    return [{"id": u.id, "name": u.name, "email": u.email} for u in users_db]

@app.get("/api/users/{user_id}")
def rest_get_user(user_id: int):
    user = next((u for u in users_db if u.id == user_id), None)
    return {"id": user.id, "name": user.name, "email": user.email} if user else {}
```

The GraphQL query `{ user(id: 1) { name } }` returns only the `name` field, while REST `/api/users/1` always returns all fields. Choose based on your team's capabilities, client diversity, and caching requirements.
