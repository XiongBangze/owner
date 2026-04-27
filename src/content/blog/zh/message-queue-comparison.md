---
title: "消息队列选型"
date: "2026-03-14"
description: "对比 Kafka、RabbitMQ 和 Redis Streams 三大消息队列的架构特点、适用场景与性能差异，帮助你做出正确的技术选型。"
tags: ["Kafka", "RabbitMQ", "Redis Streams"]
---

消息队列是分布式系统中解耦、削峰和异步通信的核心组件。Kafka、RabbitMQ 和 Redis Streams 是当前最主流的三种方案，各有其设计哲学和最佳适用场景。

**Kafka** 采用分区日志（partitioned log）架构，消息持久化到磁盘并支持消费者组（consumer group）。它的核心优势在于超高吞吐量（百万级 TPS）和消息回溯能力，适合日志收集、事件溯源和流处理场景。但 Kafka 的运维复杂度较高，依赖 ZooKeeper（或 KRaft），且对低延迟点对点消息场景并非最优选择。

**RabbitMQ** 基于 AMQP 协议，提供灵活的路由机制（direct、topic、fanout、headers exchange）。它支持消息确认、死信队列和优先级队列，非常适合需要复杂路由逻辑的业务系统。RabbitMQ 的延迟通常在毫秒级，但吞吐量不及 Kafka。

**Redis Streams** 是 Redis 5.0 引入的数据结构，兼具消息队列和时间序列的特性。它支持消费者组、消息确认和持久化，且部署极其简单。适合中小规模、已有 Redis 基础设施的场景，但在大规模数据持久化和集群扩展方面不如 Kafka。

选型建议：高吞吐流处理选 Kafka，复杂路由业务选 RabbitMQ，轻量快速选 Redis Streams。

```python
import redis

r = redis.Redis()

# 生产者：写入消息
r.xadd("order_stream", {"order_id": "1001", "action": "created", "amount": "99.5"})

# 消费者组：创建并消费
r.xgroup_create("order_stream", "order_service", id="0", mkstream=True)

messages = r.xreadgroup("order_service", "worker-1", {"order_stream": ">"}, count=10, block=5000)
for stream, entries in messages:
    for msg_id, data in entries:
        print(f"处理订单: {data}")
        r.xack("order_stream", "order_service", msg_id)
```
