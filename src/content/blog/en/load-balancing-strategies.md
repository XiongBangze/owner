---
title: "Load Balancing Strategies"
date: "2026-03-09"
description: "In-depth analysis of Round Robin, Weighted Round Robin, Least Connections, and Consistent Hashing algorithms, with Nginx configuration for high availability."
tags: ["load balancing", "Nginx", "high availability"]
---

Load balancing is a core component of high-availability architecture, distributing traffic across multiple backend instances to prevent single-point overload and improve overall system throughput. Understanding the characteristics of different algorithms is essential for making the right choice for your use case.

**Round Robin** is the simplest strategy, assigning requests sequentially. It works well when backend instances have identical configurations but cannot sense actual instance load. **Weighted Round Robin** extends this by assigning weights to each instance, directing more traffic to higher-capacity servers.

**Least Connections** routes requests to the instance with the fewest active connections, ideal for scenarios where request processing times vary significantly. **IP Hash** computes a hash from the client IP, ensuring the same client always reaches the same backend — suitable for session persistence.

**Consistent Hashing** is an advanced strategy for distributed systems. It maps nodes onto a hash ring so that when nodes are added or removed, only adjacent nodes' traffic is affected, minimizing cache invalidation. This is particularly important in distributed caching and database sharding.

Health checking is an indispensable companion to load balancing. Active health checks periodically probe backend instances, while passive health checks automatically remove failed nodes based on request failure counts.

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

# Usage
ch = ConsistentHash(["server-1:8080", "server-2:8080", "server-3:8080"])
for user_id in ["user_1001", "user_1002", "user_1003"]:
    print(f"{user_id} -> {ch.get_node(user_id)}")
```
