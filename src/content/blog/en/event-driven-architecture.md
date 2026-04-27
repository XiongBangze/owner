---
title: "Event-Driven Architecture"
date: "2026-02-25"
description: "Understanding the core concepts of event-driven architecture, implementing event pub/sub and eventual consistency with Kafka and Python."
tags: ["Event-Driven", "Kafka", "Architecture"]
---

Event-Driven Architecture (EDA) is a system design paradigm where events serve as the core communication mechanism. Unlike traditional request-response patterns, services in EDA communicate asynchronously by publishing and subscribing to events, achieving loose coupling and high scalability.

The three core components of EDA are: event producers, event channels (brokers), and event consumers. Events typically contain a type, timestamp, source, and payload. Apache Kafka is the most popular event streaming platform, providing persistence, partitioning, and consumer group mechanisms for high-throughput event processing.

The key challenge in EDA is eventual consistency. Since events are delivered asynchronously, the system may be in an inconsistent state at any given moment. Solutions include: idempotent consumers (ensuring repeated processing of the same event produces no side effects), the Outbox Pattern (writing events to an outbox table within a database transaction, then publishing to Kafka via a separate process), and the Saga Pattern (achieving distributed transactions through orchestration or choreography of multiple services' local transactions).

The following example implements event publishing and consumption with `confluent-kafka`:

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

# Event producer
def publish_event(producer: Producer, topic: str, event: OrderEvent):
    producer.produce(
        topic,
        key=event.order_id,
        value=json.dumps(asdict(event)),
        callback=lambda err, msg: print(f"Delivered: {msg.topic()}[{msg.partition()}]" if not err else f"Error: {err}"),
    )
    producer.flush()

# Idempotent consumer
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

# Usage
if __name__ == "__main__":
    producer = Producer({"bootstrap.servers": "localhost:9092"})
    event = OrderEvent("order_created", "ORD-001", "USR-42", 99.99)
    publish_event(producer, "orders", event)
```

Event-driven architecture is particularly well-suited for order processing, notification systems, and data synchronization, but requires the team to handle asynchronous complexity and eventual consistency.
