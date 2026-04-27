---
title: "微服务通信模式"
date: "2026-03-17"
description: "深入对比微服务间的同步与异步通信模式，涵盖 gRPC、消息队列和事件驱动架构。"
tags: ["微服务", "gRPC", "消息队列"]
---

微服务架构中，服务间通信模式的选择直接影响系统的性能、可靠性和可维护性。本文对比三种主流通信模式及其适用场景。

## 同步通信：gRPC

gRPC 基于 HTTP/2 和 Protocol Buffers，提供强类型契约、双向流、头部压缩和多路复用。相比 REST，gRPC 的序列化效率高 5-10 倍，延迟更低。适合服务间的实时调用，如 AI 推理网关调用模型服务。通过 `.proto` 文件定义接口，可以自动生成多语言客户端代码，确保接口一致性。

## 异步通信：消息队列

当调用方不需要立即获得结果时，消息队列（RabbitMQ、Kafka）是更好的选择。生产者将消息发送到队列，消费者异步处理。这种模式实现了时间解耦和负载削峰。Kafka 的分区机制还支持有序消费和消费者组的水平扩展。适合数据管道、事件通知、异步任务分发等场景。

## 事件驱动架构

事件驱动将服务间的直接调用转变为事件发布/订阅。服务只关心自己感兴趣的事件，不需要知道事件的生产者。这种松耦合使得新增服务不需要修改现有服务。结合事件溯源（Event Sourcing），可以重建任意时间点的系统状态，非常适合审计和调试。

```python
# ---- gRPC 服务端 ----
import grpc
from concurrent import futures
from dataclasses import dataclass

# 模拟 protobuf 生成的类
@dataclass
class PredictRequest:
    model_id: str
    input_text: str

@dataclass
class PredictResponse:
    output: str
    latency_ms: float

class InferenceServicer:
    """gRPC 推理服务实现"""
    def Predict(self, request: PredictRequest) -> PredictResponse:
        import time
        start = time.perf_counter()
        result = f"prediction for: {request.input_text[:50]}"
        latency = (time.perf_counter() - start) * 1000
        return PredictResponse(output=result, latency_ms=latency)

# ---- 消息队列：事件发布/订阅 ----
import json
import asyncio
import aio_pika

class EventBus:
    def __init__(self, amqp_url: str = "amqp://localhost"):
        self.url = amqp_url
        self._connection = None
        self._channel = None

    async def connect(self):
        self._connection = await aio_pika.connect_robust(self.url)
        self._channel = await self._connection.channel()

    async def publish(self, event_type: str, payload: dict):
        exchange = await self._channel.declare_exchange("events", aio_pika.ExchangeType.TOPIC)
        message = aio_pika.Message(
            body=json.dumps({"type": event_type, **payload}).encode(),
            content_type="application/json",
        )
        await exchange.publish(message, routing_key=event_type)

    async def subscribe(self, pattern: str, handler):
        exchange = await self._channel.declare_exchange("events", aio_pika.ExchangeType.TOPIC)
        queue = await self._channel.declare_queue("", exclusive=True)
        await queue.bind(exchange, routing_key=pattern)
        async with queue.iterator() as it:
            async for msg in it:
                async with msg.process():
                    event = json.loads(msg.body)
                    await handler(event)

# 使用示例
async def on_inference_complete(event: dict):
    print(f"Inference done: {event}")

async def main():
    bus = EventBus()
    await bus.connect()
    await bus.publish("inference.completed", {"model": "gpt-4", "tokens": 150})
```
