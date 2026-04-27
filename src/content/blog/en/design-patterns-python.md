---
title: "Design Patterns in Python"
date: "2026-02-26"
description: "Exploring Pythonic implementations of Strategy, Observer, and Factory patterns, leveraging language features to simplify classic design patterns."
tags: ["Design Patterns", "Python", "Architecture"]
---

Design patterns are general solutions to recurring software design problems. In Python, however, thanks to first-class functions, duck typing, and decorators, many classic patterns can be implemented far more concisely without heavy class hierarchies.

The Strategy Pattern requires interfaces and multiple implementation classes in Java, but in Python, functions are first-class citizens — simply passing a function achieves strategy switching. The Observer Pattern can be implemented with a simple callback list without defining Subject and Observer interfaces. The Factory Pattern can replace if-else chains with dictionary mappings, combined with `__init_subclass__` for automatic registration.

When choosing design patterns, follow the "minimum necessary" principle: if a simple function solves the problem, don't introduce a class; if a class solves it, don't introduce an inheritance hierarchy. Over-engineering is more harmful than no design at all.

The following example demonstrates Pythonic implementations of three patterns:

```python
from typing import Callable

# === Strategy Pattern: functions replace strategy classes ===
def price_with_discount(price: float) -> float:
    return price * 0.9

def price_with_tax(price: float) -> float:
    return price * 1.13

def calculate(price: float, strategy: Callable[[float], float]) -> float:
    return strategy(price)

print(calculate(100, price_with_discount))  # 90.0
print(calculate(100, price_with_tax))       # 113.0

# === Observer Pattern: callback list ===
class EventBus:
    def __init__(self):
        self._listeners: dict[str, list[Callable]] = {}

    def on(self, event: str, callback: Callable):
        self._listeners.setdefault(event, []).append(callback)

    def emit(self, event: str, data=None):
        for cb in self._listeners.get(event, []):
            cb(data)

bus = EventBus()
bus.on("user_created", lambda u: print(f"Send welcome email to {u}"))
bus.on("user_created", lambda u: print(f"Init default settings for {u}"))
bus.emit("user_created", "Alice")

# === Factory Pattern: auto-registering subclasses ===
class Serializer:
    _registry: dict[str, type] = {}

    def __init_subclass__(cls, fmt: str = "", **kwargs):
        super().__init_subclass__(**kwargs)
        if fmt:
            Serializer._registry[fmt] = cls

    @classmethod
    def create(cls, fmt: str) -> "Serializer":
        return cls._registry[fmt]()

    def serialize(self, data: dict) -> str:
        raise NotImplementedError

class JsonSerializer(Serializer, fmt="json"):
    def serialize(self, data: dict) -> str:
        import json
        return json.dumps(data)

class CsvSerializer(Serializer, fmt="csv"):
    def serialize(self, data: dict) -> str:
        return ",".join(f"{k}={v}" for k, v in data.items())

s = Serializer.create("json")
print(s.serialize({"name": "Alice"}))  # {"name": "Alice"}
```

Python's dynamic nature makes design pattern implementations lightweight. The key is understanding the intent behind patterns rather than mechanically applying their structure.
