---
title: "数据库连接池优化"
date: "2026-03-16"
description: "深入理解数据库连接池原理，使用 SQLAlchemy 实现高效的连接管理、健康检查和性能调优。"
tags: ["数据库", "连接池", "SQLAlchemy"]
---

数据库连接的创建和销毁是昂贵的操作（TCP 握手、认证、SSL 协商）。连接池通过复用已建立的连接，将每次查询的连接开销从毫秒级降低到微秒级。

## 连接池核心参数

`pool_size` 定义常驻连接数，`max_overflow` 定义突发时可额外创建的连接数。两者之和是最大并发连接数。设置过小会导致请求排队等待，设置过大会耗尽数据库连接资源。经验法则：`pool_size` 设为 Worker 数的 2-3 倍，`max_overflow` 设为 `pool_size` 的 50%-100%。

## 连接健康检查

长时间空闲的连接可能被数据库服务器或中间防火墙断开。`pool_pre_ping=True` 在每次从池中取出连接时发送轻量级检测（SELECT 1），确保连接可用。`pool_recycle` 设置连接的最大存活时间，定期回收避免使用过期连接。

## 异步连接池

AI 服务通常使用异步框架（FastAPI），需要异步数据库驱动。SQLAlchemy 2.0 的 `create_async_engine` 配合 `asyncpg`（PostgreSQL）或 `aiomysql`（MySQL）提供原生异步连接池。异步连接池的参数调优原则与同步相同，但需要注意避免在异步上下文中执行同步阻塞操作。

## 监控与诊断

连接池的关键指标包括：活跃连接数、空闲连接数、等待获取连接的请求数、连接创建/销毁速率。通过监听 SQLAlchemy 的事件系统，可以采集这些指标并暴露给 Prometheus。

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

    # 连接池监控
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
