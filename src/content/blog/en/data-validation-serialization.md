---
title: "Data Validation and Serialization"
date: "2026-03-03"
description: "Implementing strongly-typed data validation and serialization with Pydantic, covering custom validators, nested models, and performance optimization."
tags: ["Pydantic", "Validation", "Python"]
---

Data validation is the first line of defense in backend development. Unvalidated input can lead to SQL injection, type errors, and even business logic vulnerabilities. Pydantic is the most popular data validation library in the Python ecosystem, automatically handling parsing, validation, and serialization based on type annotations — with V2 achieving order-of-magnitude performance gains through its Rust core.

At the heart of Pydantic is `BaseModel`. When defining a model, field types serve as validation rules: `str` auto-coerces input to strings, `int` rejects non-convertible values, and `EmailStr` validates email format. For complex business rules, use `@field_validator` for custom field-level logic and `@model_validator` for cross-field validation.

For serialization, `model_dump()` converts a model to a dictionary, and `model_dump_json()` outputs a JSON string directly. Use `Field(exclude=True)` to hide sensitive fields (like passwords) during serialization. Nested models naturally support recursive validation and serialization, making them ideal for complex API request/response structures.

The following example demonstrates custom validators, nested models, and serialization control:

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

# Usage
user = UserCreate(
    username="alice",
    email="alice@example.com",
    password="securepass",
    password_confirm="securepass",
    age=28,
    address={"city": "Beijing", "zip_code": "100000"},
)
print(user.model_dump())
# Output excludes password and password_confirm
# {'username': 'alice', 'email': 'alice@example.com', 'age': 28,
#  'address': {'city': 'Beijing', 'zip_code': '100000'}}
```

Pydantic integrates deeply with FastAPI — model definitions serve as documentation, validation, and serialization all at once, forming the cornerstone of robust API development.
