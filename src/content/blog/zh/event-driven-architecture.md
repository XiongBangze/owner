---
title: "服务端事件驱动架构"
date: "2026-02-25"
description: "深入理解事件驱动架构的核心概念，使用 Kafka 和 Python 实现事件发布/订阅与最终一致性。"
tags: ["事件驱动", "Kafka", "架构"]
---

事件驱动架构（Event-Driven Architecture, EDA）是一种以事件为核心通信机制的系统设计范式。与传统的请求-响应模式不同，EDA 中的服务通过发布和订阅事件进行异步通信，实现松耦合和高可扩展性。

EDA 的三个核心组件是：事件生产者（Producer）、事件通道（Channel/Broker）和事件消费者（Consumer）。事件通常包含类型、时间戳、来源和负载数据。Apache Kafka 是最流行的事件流平台，提供持久化、分区和消费者组机制，支持高吞吐量的事件处理。

EDA 的关键挑战是最终一致性。由于事件是异步传递的，系统在某一时刻可能处于不一致状态。解决方案包括：幂等消费者（确保重复处理同一事件不会产生副作用）、Outbox 模式（将事件写入数据库事务中的 outbox 表，再由独立进程发布到 Kafka）、以及 Saga 模式（通过编排或协调多个服务的本地事务实现分布式事务）。

以下示例使用 `confluent-kafka` 实现事件发布与消费：

```python
import json
from datetime import datetime, timezone
from confluent_kafka import Producer, Consumer, KafkaError
from dataclasses import dataclass, asdict

@dataclass
class OrderEvent:
    event_type: str
    order_id: str
    user_id: str
    amount: float
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

# 事件生产者
def publish_event(producer: Producer, topic: str, event: OrderEvent):
    producer.produce(
        topic,
        key=event.order_id,
        value=json.dumps(asdict(event)),
        callback=lambda err, msg: print(f"Delivered: {msg.topic()}[{msg.partition()}]" if not err else f"Error: {err}"),
    )
    producer.flush()

# 幂等消费者
processed_ids: set[str] = set()

def consume_events(consumer: Consumer, topics: list[str]):
    consumer.subscribe(topics)
    while True:
        msg = consumer.poll(1.0)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() != KafkaError._PARTITION_EOF:
                print(f"Consumer error: {msg.error()}")
            continue
        event = json.loads(msg.value())
        event_id = f"{event['event_type']}:{event['order_id']}"
        if event_id in processed_ids:
            print(f"Skipping duplicate: {event_id}")
            continue
        processed_ids.add(event_id)
        print(f"Processing: {event}")

# 使用示例
if __name__ == "__main__":
    producer = Producer({"bootstrap.servers": "localhost:9092"})
    event = OrderEvent("order_created", "ORD-001", "USR-42", 99.99)
    publish_event(producer, "orders", event)
```

事件驱动架构特别适合订单处理、通知系统和数据同步等场景，但需要团队具备处理异步复杂性和最终一致性的能力。
