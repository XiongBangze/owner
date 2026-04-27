---
title: "Configuration Management Best Practices"
date: "2026-03-01"
description: "Exploring configuration management strategies in Python projects, including environment variables, layered configs, and type-safe settings models."
tags: ["Configuration Management", "Environment Variables", "Python"]
---

Configuration management is an often-overlooked yet critical aspect of software engineering. Hard-coded config values lead to difficult environment switching, sensitive data leaks, and fragile deployment pipelines. Following the 12-Factor App principles, configuration should be injected via environment variables and strictly separated from code.

Three common approaches exist in Python projects: reading `os.environ` directly, using `.env` files with `python-dotenv`, and using Pydantic's `BaseSettings` for type-safe configuration models. The third approach is recommended — it automatically loads config from environment variables and `.env` files while providing type validation, defaults, and nested configuration support.

Layered configuration is another important practice. Typically you define base → development → staging → production layers, with each layer overriding specific values from the previous one. Sensitive configs (database passwords, API keys) should never appear in the code repository — inject them through secret management services (AWS Secrets Manager, HashiCorp Vault).

The following example demonstrates type-safe configuration management with Pydantic Settings:

```python
from pydantic_settings import BaseSettings
from pydantic import Field

class DatabaseSettings(BaseSettings):
    host: str = "localhost"
    port: int = 5432
    name: str = "mydb"
    user: str = "postgres"
    password: str = Field(default="changeme")

    @property
    def url(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"

    model_config = {"env_prefix": "DB_"}

class AppSettings(BaseSettings):
    debug: bool = False
    secret_key: str = Field(default="dev-secret")
    allowed_hosts: list[str] = ["localhost"]
    db: DatabaseSettings = DatabaseSettings()

    model_config = {"env_prefix": "APP_", "env_file": ".env"}

# Usage: env var DB_HOST=prod-db.example.com auto-overrides the default
settings = AppSettings()
print(settings.db.url)
print(f"Debug: {settings.debug}, Hosts: {settings.allowed_hosts}")
```

Combine `.env` files for local development with environment variables for production deployment to achieve a secure, flexible, and type-safe configuration management system.
