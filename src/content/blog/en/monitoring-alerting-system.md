---
title: "Building a Monitoring and Alerting System"
date: "2026-03-10"
description: "Setting up a complete monitoring and alerting system with Prometheus + Grafana, covering metrics collection, dashboards, and alert rule configuration."
tags: ["Prometheus", "Grafana", "monitoring"]
---

Observability is the foundation for keeping production systems stable, and monitoring with alerting is its most critical component. Prometheus + Grafana has become the de facto standard for cloud-native monitoring.

**Prometheus** uses a pull model, periodically scraping metrics from target services' `/metrics` endpoints. It stores data in a custom time-series database and supports the powerful PromQL query language. Core metric types include: Counter (monotonically increasing, e.g., total requests), Gauge (values that go up and down, e.g., memory usage), Histogram (distribution statistics, e.g., request latency percentiles), and Summary (similar to Histogram but computes quantiles client-side).

**Grafana** provides rich visualization capabilities, transforming Prometheus metrics into intuitive charts via Dashboards. Key practices include: organizing Dashboards by service dimension, setting appropriate refresh intervals, and using Variables for dynamic filtering.

**Alert rules** are the final piece. Prometheus Alertmanager supports PromQL-based alert rules with grouping, inhibition, and silence mechanisms to prevent alert storms. Alerts should follow the "actionable" principle — every alert should have clear remediation steps.

```python
from prometheus_client import Counter, Histogram, start_http_server
import time, random

REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "Request latency", ["endpoint"],
                            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5])

def handle_request(endpoint: str):
    start = time.time()
    status = "200" if random.random() > 0.05 else "500"
    time.sleep(random.uniform(0.01, 0.5))  # Simulate processing
    REQUEST_LATENCY.labels(endpoint=endpoint).observe(time.time() - start)
    REQUEST_COUNT.labels(method="GET", endpoint=endpoint, status=status).inc()

if __name__ == "__main__":
    start_http_server(8000)  # Expose /metrics endpoint
    while True:
        handle_request("/api/users")
        handle_request("/api/orders")
```
