---
title: "Graceful Error Handling"
date: "2026-03-06"
description: "Exploring elegant error handling patterns in Python, including custom exception hierarchies, the Result pattern, error context propagation, and structured logging."
tags: ["error handling", "exceptions", "Python"]
---

Error handling is a key indicator of code quality. Crude `except Exception` swallows critical error information, while excessive try-except blocks make code bloated and hard to read. Graceful error handling requires balancing robustness with readability.

**Custom exception hierarchies** are the first step. Define a base exception class for each business module, then derive specific exception types. This enables precise catching at different levels: the business layer catches business exceptions to return friendly messages, the framework layer catches base exceptions for unified handling, and unexpected exceptions are reported to monitoring systems.

**Result pattern** borrows from Rust's philosophy, using return values instead of exceptions to express expected failures. This pattern forces callers to handle errors, preventing exceptions from being accidentally ignored. In Python, it can be implemented with dataclasses or Union types.

**Error context propagation** is crucial. Python 3's exception chaining (`raise ... from ...`) preserves the original error's complete call stack. Combined with structured logging (e.g., structlog), attaching context like request ID, user ID, and operation type to error logs dramatically improves debugging efficiency.

Core principles: only catch exceptions you can handle, let unhandled exceptions propagate upward; never silently swallow exceptions; at system boundaries (API entry points, message consumers), uniformly convert exceptions to user-friendly responses.

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
        return Result.success(user) if user else Result.fail(f"User not found: {user_id}")
    except ConnectionError as e:
        raise AppError("Database connection failed", code="DB_ERROR") from e

result = get_user("u123")
if result.ok:
    print(result.value)
else:
    print(f"Error: {result.error}")
```
