---
title: "负载均衡策略"
date: "2026-03-09"
description: "深入解析轮询、加权轮询、最少连接、一致性哈希等负载均衡算法，结合 Nginx 配置实现高可用架构。"
tags: ["负载均衡", "Nginx", "高可用"]
---

负载均衡是高可用架构的核心组件，它将流量分发到多个后端实例，避免单点过载并提升系统整体吞吐量。理解不同负载均衡算法的特性，才能根据业务场景做出正确选择。

**轮询（Round Robin）** 是最简单的策略，按顺序依次分配请求。适合后端实例配置相同的场景，但无法感知实例的实际负载。**加权轮询（Weighted Round Robin）** 在此基础上为每个实例分配权重，高配置实例承担更多流量。

**最少连接（Least Connections）** 将请求分配给当前活跃连接数最少的实例，适合请求处理时间差异较大的场景。**IP 哈希（IP Hash）** 根据客户端 IP 计算哈希值，确保同一客户端始终访问同一后端，适合需要会话保持的场景。

**一致性哈希（Consistent Hashing）** 是分布式系统中的高级策略。它将节点映射到哈希环上，当节点增减时只影响相邻节点的流量，最大限度减少缓存失效。这在分布式缓存和数据库分片中尤为重要。

健康检查是负载均衡不可或缺的配套机制。主动健康检查定期探测后端实例，被动健康检查根据请求失败次数自动摘除故障节点。

```python
import hashlib
from bisect import bisect_right

class ConsistentHash:
    def __init__(self, nodes: list[str], replicas: int = 150):
        self.ring: list[int] = []
        self.node_map: dict[int, str] = {}
        for node in nodes:
            for i in range(replicas):
                h = int(hashlib.md5(f"{node}:{i}".encode()).hexdigest(), 16)
                self.ring.append(h)
                self.node_map[h] = node
        self.ring.sort()

    def get_node(self, key: str) -> str:
        h = int(hashlib.md5(key.encode()).hexdigest(), 16)
        idx = bisect_right(self.ring, h) % len(self.ring)
        return self.node_map[self.ring[idx]]

# 使用示例
ch = ConsistentHash(["server-1:8080", "server-2:8080", "server-3:8080"])
for user_id in ["user_1001", "user_1002", "user_1003"]:
    print(f"{user_id} -> {ch.get_node(user_id)}")
```
