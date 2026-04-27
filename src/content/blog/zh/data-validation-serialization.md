---
title: "数据验证与序列化"
date: "2026-03-03"
description: "使用 Pydantic 实现强类型数据验证与序列化，涵盖自定义校验器、嵌套模型与性能优化。"
tags: ["Pydantic", "验证", "Python"]
---

数据验证是后端开发的第一道防线。未经验证的输入可能导致 SQL 注入、类型错误甚至业务逻辑漏洞。Pydantic 是 Python 生态中最流行的数据验证库，基于类型注解自动完成解析、验证和序列化，且在 V2 版本中通过 Rust 核心实现了数量级的性能提升。

Pydantic 的核心是 `BaseModel`。定义模型时，字段类型即为验证规则：`str` 会自动将输入转为字符串，`int` 会拒绝无法转换的值，`EmailStr` 会校验邮箱格式。对于复杂业务规则，可以使用 `@field_validator` 定义自定义校验逻辑，使用 `@model_validator` 实现跨字段联合校验。

在序列化方面，`model_dump()` 将模型转为字典，`model_dump_json()` 直接输出 JSON 字符串。通过 `Field(exclude=True)` 可以在序列化时隐藏敏感字段（如密码）。嵌套模型天然支持递归验证和序列化，非常适合处理复杂的 API 请求/响应结构。

以下示例展示了自定义校验器、嵌套模型和序列化控制：

```python
from pydantic import BaseModel, Field, field_validator, model_validator, EmailStr

class Address(BaseModel):
    city: str
    zip_code: str

    @field_validator("zip_code")
    @classmethod
    def validate_zip(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("Zip code must be 6 digits")
        return v

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=20)
    email: EmailStr
    password: str = Field(min_length=8, exclude=True)
    password_confirm: str = Field(exclude=True)
    age: int = Field(ge=0, le=150)
    address: Address

    @model_validator(mode="after")
    def check_passwords_match(self):
        if self.password != self.password_confirm:
            raise ValueError("Passwords do not match")
        return self

# 使用示例
user = UserCreate(
    username="alice",
    email="alice@example.com",
    password="securepass",
    password_confirm="securepass",
    age=28,
    address={"city": "Beijing", "zip_code": "100000"},
)
print(user.model_dump())
# 输出不含 password 和 password_confirm
# {'username': 'alice', 'email': 'alice@example.com', 'age': 28,
#  'address': {'city': 'Beijing', 'zip_code': '100000'}}
```

Pydantic 与 FastAPI 深度集成，模型定义即文档、即验证、即序列化，是构建健壮 API 的基石。
