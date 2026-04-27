---
title: "Logging System Design"
date: "2026-03-18"
description: "Design a structured logging system integrated with the ELK stack for log collection, search, and alerting to improve AI service observability."
tags: ["Logging", "ELK", "Python"]
---

Debugging and operating AI services heavily depends on logging. Unstructured text logs are nearly impossible to search and analyze in distributed systems. Structured logging combined with a centralized log platform (ELK) is the production standard.

## Structured Logging

Traditional `print` or plain-text logs are virtually unusable in distributed systems. Structured logs output in JSON format, with each entry containing timestamp, level, service name, request ID, user ID, and other fields. This enables Elasticsearch indexing for precise queries and aggregate analysis. Python's `logging` module with a custom Formatter achieves this easily.

## Request Tracing

In microservice architectures, a single user request may traverse multiple services. By generating a unique trace_id at the request entry point and propagating it across services, logs scattered across different services can be correlated. Combined with FastAPI middleware, tracing context is automatically injected into every request.

## AI-Specific Logging Needs

AI services need to record additional information: model name and version, inference latency, token usage, prompt length, etc. These metrics serve both cost accounting and model performance monitoring. Sensitive user inputs should be anonymized before logging to prevent privacy leaks.

## Log Collection and Alerting

Filebeat collects container logs and sends them to Logstash for parsing and enrichment, ultimately storing them in Elasticsearch. Kibana provides visualization dashboards, and Watcher or ElastAlert enables anomaly alerting (e.g., error rate spikes, inference latency surges).

```python
import json
import logging
import time
import uuid
from contextvars import ContextVar
from fastapi import FastAPI, Request

trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log = {
            "ts": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "trace_id": trace_id_var.get(""),
        }
        if record.exc_info and record.exc_info[0]:
            log["exception"] = self.formatException(record.exc_info)
        if extras := getattr(record, "extras", None):
            log.update(extras)
        return json.dumps(log, ensure_ascii=False)

def setup_logging(level: str = "INFO"):
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]

app = FastAPI()
logger = logging.getLogger("ai_service")

@app.middleware("http")
async def tracing_middleware(request: Request, call_next):
    tid = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
    trace_id_var.set(tid)
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info("request", extra={"extras": {
        "method": request.method, "path": request.url.path,
        "status": response.status_code, "duration_ms": round(duration_ms, 2),
    }})
    response.headers["X-Trace-ID"] = tid
    return response

@app.on_event("startup")
def on_startup():
    setup_logging()
```
