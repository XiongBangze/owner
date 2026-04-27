---
title: "Database Migration Strategies"
date: "2026-02-28"
description: "Implementing safe and reliable database migrations with Alembic and SQLAlchemy, covering auto-generation, manual adjustments, and rollback strategies."
tags: ["Database Migration", "Alembic", "SQLAlchemy"]
---

Database migration is one of the riskiest operations in backend development. A single bad migration can cause data loss or service outages. Alembic is the standard migration tool in the SQLAlchemy ecosystem, managing schema changes through versioned migration scripts with support for both auto-generation and manual authoring.

Alembic's core concept is the "revision chain." Each migration script contains `upgrade()` and `downgrade()` functions that define forward and rollback operations respectively. `alembic revision --autogenerate` compares current model definitions against the actual database schema to generate differential migration scripts. However, auto-generation isn't perfect — column renames are detected as "drop + add" and require manual correction.

Production migration best practices include: always execute migrations within transactions; use `ALTER TABLE ... ADD COLUMN ... DEFAULT NULL` for large tables to avoid table locks; separate data migrations from schema migrations; validate migration scripts in staging before each deployment; and maintain rollback capability by ensuring `downgrade()` functions are correctly implemented.

The following example demonstrates the basic Alembic workflow:

```python
# models.py — SQLAlchemy model definitions
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

# In alembic/env.py, set target_metadata = Base.metadata

# --- Example auto-generated migration script ---
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

Run `alembic upgrade head` to apply migrations and `alembic downgrade -1` to roll back one step. Commit migration scripts to version control to ensure consistent database state across team members and CI/CD pipelines.
