---
title: "优雅的错误处理"
date: "2026-03-06"
description: "探讨 Python 中优雅错误处理的设计模式，包括自定义异常体系、Result 模式、错误上下文传递与结构化日志记录。"
tags: ["错误处理", "异常", "Python"]
---

错误处理是代码质量的重要标志。粗糙的 `except Exception` 会吞掉关键错误信息，而过度的 try-except 又会让代码臃肿难读。优雅的错误处理需要在健壮性和可读性之间找到平衡。

**自定义异常体系**是第一步。为业务模块定义异常基类，再派生具体异常类型。这样可以在不同层级精确捕获：业务层捕获业务异常返回友好提示，框架层捕获基类异常统一处理，未预期异常则上报监控系统。

**Result 模式**借鉴 Rust 的思想，用返回值而非异常表达可预期的失败。这种模式强制调用方处理错误，避免异常被意外忽略。Python 中可通过 dataclass 或 Union 类型实现。

**错误上下文传递**至关重要。Python 3 的异常链（`raise ... from ...`）能保留原始错误的完整调用栈。结合结构化日志（如 structlog），将请求 ID、用户 ID、操作类型等上下文信息附加到错误日志中，极大提升了问题排查效率。

核心原则：只捕获你能处理的异常，让不能处理的异常向上传播；永远不要静默吞掉异常；在系统边界（API 入口、消息消费者）统一转换异常为用户友好的响应。

```python
from dataclasses import dataclass
from typing import TypeVar, Generic

T = TypeVar("T")

@dataclass
class Result(Generic[T]):
    value: T | None = None
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None

    @staticmethod
    def success(value: T) -> "Result[T]":
        return Result(value=value)

    @staticmethod
    def fail(error: str) -> "Result[T]":
        return Result(error=error)

class AppError(Exception):
    def __init__(self, message: str, code: str, context: dict | None = None):
        super().__init__(message)
        self.code = code
        self.context = context or {}

class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(f"{resource} not found: {resource_id}", code="NOT_FOUND",
                         context={"resource": resource, "id": resource_id})

def get_user(user_id: str) -> Result[dict]:
    try:
        user = db_find_user(user_id)
        return Result.success(user) if user else Result.fail(f"用户不存在: {user_id}")
    except ConnectionError as e:
        raise AppError("数据库连接失败", code="DB_ERROR") from e

result = get_user("u123")
if result.ok:
    print(result.value)
else:
    print(f"错误: {result.error}")
```
