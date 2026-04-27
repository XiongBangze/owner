---
title: "Unit Testing and Mocking"
date: "2026-02-27"
description: "Writing high-quality unit tests with pytest and unittest.mock, mastering Mock, Patch, and Fixture techniques."
tags: ["Testing", "pytest", "Mock"]
---

Unit testing is the cornerstone of code quality. Good unit tests should be fast, independent, repeatable, and test only one behavioral unit. When the code under test depends on external services (databases, HTTP APIs, file systems), mocking isolates these dependencies so tests focus purely on business logic.

Python's `unittest.mock` provides powerful mocking capabilities. `MagicMock` can simulate any object, and the `patch` decorator temporarily replaces objects in a module during tests. The key principle is "patch where it's used, not where it's defined" — if `module_a` imports `func` from `module_b`, patch `module_a.func`, not `module_b.func`.

pytest's Fixture mechanism provides elegant test resource management. Define reusable test preconditions with `@pytest.fixture`, with scope control (function/class/module/session) and automatic cleanup (yield fixtures). Combine with `conftest.py` to share fixtures at the project level.

The following example demonstrates mocking external API calls and using fixtures:

```python
import pytest
from unittest.mock import patch, MagicMock

# Business code under test
class UserService:
    def __init__(self, http_client):
        self.client = http_client

    def get_user_profile(self, user_id: int) -> dict:
        resp = self.client.get(f"/api/users/{user_id}")
        if resp.status_code != 200:
            raise ValueError(f"User {user_id} not found")
        data = resp.json()
        return {"name": data["name"], "active": data.get("active", False)}

# Fixture: create Service with a mock client
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

Test coverage is a means, not a goal. Prioritize covering core business logic and edge cases over chasing 100% line coverage.
