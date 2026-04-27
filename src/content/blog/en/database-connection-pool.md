---
title: "Database Connection Pool Optimization"
date: "2026-03-16"
description: "Deep dive into database connection pool internals, implementing efficient connection management, health checks, and performance tuning with SQLAlchemy."
tags: ["Database", "Connection Pool", "SQLAlchemy"]
---

Creating and destroying database connections is expensive (TCP handshake, authentication, SSL negotiation). Connection pools reuse established connections, reducing per-query connection overhead from milliseconds to microseconds.

## Core Pool Parameters

`pool_size` defines the number of persistent connections, and `max_overflow` defines additional connections that can be created during bursts. Their sum is the maximum concurrent connection count. Setting them too low causes request queuing; too high exhausts database connection resources. Rule of thumb: set `pool_size` to 2-3x the worker count, and `max_overflow` to 50%-100% of `pool_size`.

## Connection Health Checks

Long-idle connections may be terminated by the database server or intermediate firewalls. `pool_pre_ping=True` sends a lightweight probe (SELECT 1) each time a connection is checked out from the pool, ensuring it's usable. `pool_recycle` sets the maximum connection lifetime, periodically recycling to avoid stale connections.

## Async Connection Pools

AI services typically use async frameworks (FastAPI) and need async database drivers. SQLAlchemy 2.0's `create_async_engine` with `asyncpg` (PostgreSQL) or `aiomysql` (MySQL) provides native async connection pools. Tuning principles are the same as synchronous pools, but be careful to avoid synchronous blocking operations in async contexts.

## Monitoring and Diagnostics

Key connection pool metrics include: active connections, idle connections, requests waiting for connections, and connection creation/destruction rates. By listening to SQLAlchemy's event system, these metrics can be collected and exposed to Prometheus.

```python
import time
import logging
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import event, text

logger = logging.getLogger(__name__)

def create_engine(database_url: str):
    engine = create_async_engine(
        database_url,
        pool_size=10,
        max_overflow=5,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_timeout=30,
        echo=False,
    )

    # Connection pool monitoring
    @event.listens_for(engine.sync_engine, "checkout")
    def on_checkout(dbapi_conn, connection_record, connection_proxy):
        connection_record.info["checkout_time"] = time.time()

    @event.listens_for(engine.sync_engine, "checkin")
    def on_checkin(dbapi_conn, connection_record):
        checkout = connection_record.info.get("checkout_time", 0)
        duration = time.time() - checkout
        if duration > 5:
            logger.warning(f"Connection held for {duration:.1f}s")

    return engine

engine = create_engine("postgresql+asyncpg://user:pass@localhost/db")
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

@asynccontextmanager
async def get_session() -> AsyncSession:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def health_check() -> dict:
    pool = engine.pool
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
    }
```
