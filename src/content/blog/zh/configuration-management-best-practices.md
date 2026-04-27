---
title: "配置管理最佳实践"
date: "2026-03-01"
description: "探讨 Python 项目中的配置管理策略，包括环境变量、分层配置和类型安全的配置模型。"
tags: ["配置管理", "环境变量", "Python"]
---

配置管理是软件工程中容易被忽视但至关重要的环节。硬编码的配置值会导致环境切换困难、敏感信息泄露和部署流程脆弱。遵循 12-Factor App 原则，配置应通过环境变量注入，与代码严格分离。

Python 项目中常见的配置管理方案有三种：直接读取 `os.environ`、使用 `.env` 文件配合 `python-dotenv`、以及使用 Pydantic 的 `BaseSettings` 实现类型安全的配置模型。推荐使用第三种方案——它不仅自动从环境变量和 `.env` 文件加载配置，还提供类型验证、默认值和嵌套配置支持。

分层配置是另一个重要实践。通常定义 base → development → staging → production 四层配置，每层覆盖上一层的特定值。敏感配置（数据库密码、API 密钥）绝不应出现在代码仓库中，应通过密钥管理服务（如 AWS Secrets Manager、HashiCorp Vault）注入。

以下示例展示基于 Pydantic Settings 的类型安全配置管理：

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

# 使用：环境变量 DB_HOST=prod-db.example.com 会自动覆盖默认值
settings = AppSettings()
print(settings.db.url)
print(f"Debug: {settings.debug}, Hosts: {settings.allowed_hosts}")
```

配合 `.env` 文件用于本地开发，环境变量用于生产部署，即可实现安全、灵活且类型安全的配置管理体系。
