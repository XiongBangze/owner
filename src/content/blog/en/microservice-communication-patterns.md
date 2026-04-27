---
title: "Microservice Communication Patterns"
date: "2026-03-17"
description: "Deep comparison of synchronous and asynchronous communication patterns between microservices, covering gRPC, message queues, and event-driven architecture."
tags: ["Microservices", "gRPC", "Message Queue"]
---

In microservice architectures, the choice of inter-service communication patterns directly impacts system performance, reliability, and maintainability. This article compares three mainstream communication patterns and their use cases.

## Synchronous Communication: gRPC

gRPC is built on HTTP/2 and Protocol Buffers, providing strongly-typed contracts, bidirectional streaming, header compression, and multiplexing. Compared to REST, gRPC serialization is 5-10x more efficient with lower latency. It's ideal for real-time inter-service calls, such as an AI inference gateway calling model services. Interface definitions via `.proto` files enable automatic multi-language client code generation, ensuring interface consistency.

## Asynchronous Communication: Message Queues

When callers don't need immediate results, message queues (RabbitMQ, Kafka) are the better choice. Producers send messages to queues, and consumers process them asynchronously. This pattern achieves temporal decoupling and load leveling. Kafka's partition mechanism also supports ordered consumption and horizontal scaling of consumer groups. Suitable for data pipelines, event notifications, and async task distribution.

## Event-Driven Architecture

Event-driven architecture transforms direct inter-service calls into event publish/subscribe. Services only care about events they're interested in, without needing to know the event producer. This loose coupling means adding new services doesn't require modifying existing ones. Combined with Event Sourcing, system state at any point in time can be reconstructed — ideal for auditing and debugging.

```python
# ---- gRPC Server ----
import grpc
from concurrent import futures
from dataclasses import dataclass

# Simulated protobuf-generated classes
@dataclass
class PredictRequest:
    model_id: str
    input_text: str

@dataclass
class PredictResponse:
    output: str
    latency_ms: float

class InferenceServicer:
    """gRPC inference service implementation"""
    def Predict(self, request: PredictRequest) -> PredictResponse:
        import time
        start = time.perf_counter()
        result = f"prediction for: {request.input_text[:50]}"
        latency = (time.perf_counter() - start) * 1000
        return PredictResponse(output=result, latency_ms=latency)

# ---- Message Queue: Event Publish/Subscribe ----
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

# Usage example
async def on_inference_complete(event: dict):
    print(f"Inference done: {event}")

async def main():
    bus = EventBus()
    await bus.connect()
    await bus.publish("inference.completed", {"model": "gpt-4", "tokens": 150})
```
