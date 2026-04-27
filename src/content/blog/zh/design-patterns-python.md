---
title: "设计模式在 Python 中的应用"
date: "2026-02-26"
description: "探讨策略模式、观察者模式和工厂模式在 Python 中的惯用实现，利用语言特性简化经典设计模式。"
tags: ["设计模式", "Python", "架构"]
---

设计模式是解决反复出现的软件设计问题的通用方案。但在 Python 中，由于一等函数、鸭子类型和装饰器等语言特性，许多经典模式可以用更简洁的方式实现，无需繁重的类层次结构。

策略模式（Strategy Pattern）在 Java 中需要定义接口和多个实现类，但在 Python 中，函数本身就是一等公民，直接传递函数即可实现策略切换。观察者模式（Observer Pattern）可以用简单的回调列表实现，无需定义 Subject 和 Observer 接口。工厂模式（Factory Pattern）可以用字典映射替代 if-else 链，结合 `__init_subclass__` 实现自动注册。

选择设计模式时应遵循"最小必要"原则：如果一个简单函数能解决问题，就不要引入类；如果一个类能解决问题，就不要引入继承层次。过度设计比没有设计更有害。

以下示例展示三种模式的 Pythonic 实现：

```python
from typing import Callable

# === 策略模式：用函数替代策略类 ===
def price_with_discount(price: float) -> float:
    return price * 0.9

def price_with_tax(price: float) -> float:
    return price * 1.13

def calculate(price: float, strategy: Callable[[float], float]) -> float:
    return strategy(price)

print(calculate(100, price_with_discount))  # 90.0
print(calculate(100, price_with_tax))       # 113.0

# === 观察者模式：回调列表 ===
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

# === 工厂模式：自动注册子类 ===
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

Python 的动态特性让设计模式的实现更加轻量，关键是理解模式背后的意图，而非机械套用结构。
