---
title: "监控告警体系搭建"
date: "2026-03-10"
description: "基于 Prometheus + Grafana 搭建完整的监控告警体系，覆盖指标采集、可视化面板与告警规则配置。"
tags: ["Prometheus", "Grafana", "监控"]
---

可观测性（Observability）是保障生产系统稳定运行的基础，而监控告警体系是其中最核心的一环。Prometheus + Grafana 已成为云原生监控的事实标准。

**Prometheus** 采用拉取（Pull）模式，定期从目标服务的 `/metrics` 端点抓取指标数据。它使用自定义的时序数据库存储，支持强大的 PromQL 查询语言。核心指标类型包括：Counter（单调递增计数器，如请求总数）、Gauge（可增可减的瞬时值，如内存使用量）、Histogram（分布统计，如请求延迟分位数）和 Summary（类似 Histogram 但在客户端计算分位数）。

**Grafana** 提供丰富的可视化能力，通过 Dashboard 将 Prometheus 指标转化为直观的图表。关键实践包括：按服务维度组织 Dashboard、设置合理的刷新间隔、使用变量（Variables）实现动态筛选。

**告警规则**是监控体系的最后一环。Prometheus Alertmanager 支持基于 PromQL 表达式的告警规则，配合分组（grouping）、抑制（inhibition）和静默（silence）机制，避免告警风暴。告警应遵循"可操作"原则——每条告警都应有明确的处理步骤。

```python
from prometheus_client import Counter, Histogram, start_http_server
import time, random

REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "Request latency", ["endpoint"],
                            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5])

def handle_request(endpoint: str):
    start = time.time()
    status = "200" if random.random() > 0.05 else "500"
    time.sleep(random.uniform(0.01, 0.5))  # 模拟处理
    REQUEST_LATENCY.labels(endpoint=endpoint).observe(time.time() - start)
    REQUEST_COUNT.labels(method="GET", endpoint=endpoint, status=status).inc()

if __name__ == "__main__":
    start_http_server(8000)  # 暴露 /metrics 端点
    while True:
        handle_request("/api/users")
        handle_request("/api/orders")
```
