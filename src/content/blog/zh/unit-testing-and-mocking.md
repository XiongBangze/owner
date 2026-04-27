---
title: "单元测试与 Mock"
date: "2026-02-27"
description: "使用 pytest 和 unittest.mock 编写高质量单元测试，掌握 Mock、Patch 和 Fixture 的实战技巧。"
tags: ["测试", "pytest", "Mock"]
---

单元测试是保障代码质量的基石。好的单元测试应该快速、独立、可重复，且只测试一个行为单元。当被测代码依赖外部服务（数据库、HTTP API、文件系统）时，Mock 技术可以隔离这些依赖，让测试专注于业务逻辑本身。

Python 中 `unittest.mock` 提供了强大的 Mock 能力。`MagicMock` 可以模拟任意对象，`patch` 装饰器可以在测试期间临时替换模块中的对象。关键原则是"在使用处 patch，而非定义处"——如果 `module_a` 从 `module_b` 导入了 `func`，应该 patch `module_a.func` 而非 `module_b.func`。

pytest 的 Fixture 机制提供了优雅的测试资源管理。通过 `@pytest.fixture` 定义可复用的测试前置条件，支持作用域控制（function/class/module/session）和自动清理（yield fixture）。结合 `conftest.py` 可以在项目级别共享 Fixture。

以下示例展示了 Mock 外部 API 调用和 Fixture 的使用：

```python
import pytest
from unittest.mock import patch, MagicMock

# 被测业务代码
class UserService:
    def __init__(self, http_client):
        self.client = http_client

    def get_user_profile(self, user_id: int) -> dict:
        resp = self.client.get(f"/api/users/{user_id}")
        if resp.status_code != 200:
            raise ValueError(f"User {user_id} not found")
        data = resp.json()
        return {"name": data["name"], "active": data.get("active", False)}

# Fixture：创建带 Mock 客户端的 Service
@pytest.fixture
def user_service():
    mock_client = MagicMock()
    return UserService(http_client=mock_client), mock_client

def test_get_user_profile_success(user_service):
    service, mock_client = user_service
    mock_client.get.return_value = MagicMock(
        status_code=200,
        json=lambda: {"name": "Alice", "active": True},
    )
    result = service.get_user_profile(1)
    assert result == {"name": "Alice", "active": True}
    mock_client.get.assert_called_once_with("/api/users/1")

def test_get_user_profile_not_found(user_service):
    service, mock_client = user_service
    mock_client.get.return_value = MagicMock(status_code=404)
    with pytest.raises(ValueError, match="User 99 not found"):
        service.get_user_profile(99)

@pytest.mark.parametrize("active,expected", [(True, True), (None, False)])
def test_active_defaults_to_false(user_service, active, expected):
    service, mock_client = user_service
    data = {"name": "Bob"} if active is None else {"name": "Bob", "active": active}
    mock_client.get.return_value = MagicMock(status_code=200, json=lambda: data)
    assert service.get_user_profile(1)["active"] == expected
```

测试覆盖率是手段而非目标。优先覆盖核心业务逻辑和边界条件，而非追求 100% 行覆盖率。
