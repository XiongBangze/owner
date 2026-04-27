---
title: "数据库迁移策略"
date: "2026-02-28"
description: "使用 Alembic 和 SQLAlchemy 实现安全可靠的数据库迁移，涵盖自动生成、手动调整与回滚策略。"
tags: ["数据库迁移", "Alembic", "SQLAlchemy"]
---

数据库迁移是后端开发中最具风险的操作之一。一次错误的迁移可能导致数据丢失或服务中断。Alembic 是 SQLAlchemy 生态中的标准迁移工具，通过版本化的迁移脚本管理数据库 Schema 变更，支持自动生成和手动编写迁移。

Alembic 的核心概念是"修订链"（Revision Chain）。每个迁移脚本包含 `upgrade()` 和 `downgrade()` 两个函数，分别定义前进和回滚操作。`alembic revision --autogenerate` 会对比当前模型定义与数据库实际 Schema，自动生成差异迁移脚本。但自动生成并非万能——列重命名会被识别为"删除+新增"，需要手动修正。

生产环境迁移的最佳实践包括：始终在事务中执行迁移；大表添加列时使用 `ALTER TABLE ... ADD COLUMN ... DEFAULT NULL` 避免锁表；数据迁移与 Schema 迁移分离；每次部署前在 staging 环境验证迁移脚本；保留回滚能力，确保 `downgrade()` 函数正确实现。

以下示例展示 Alembic 的基本工作流：

```python
# models.py — SQLAlchemy 模型定义
from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

# alembic/env.py 中设置 target_metadata = Base.metadata

# --- 自动生成迁移脚本后的示例 ---
# alembic/versions/001_create_users.py
"""create users table"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None

def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("email", sa.String(120), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

def downgrade():
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
```

执行 `alembic upgrade head` 应用迁移，`alembic downgrade -1` 回滚一步。将迁移脚本纳入版本控制，确保团队成员和 CI/CD 流水线使用一致的数据库状态。
