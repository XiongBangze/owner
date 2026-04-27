---
title: "Distributed Task Queues"
date: "2026-03-22"
description: "Build distributed task queues with Celery for AI inference, data processing, and async workloads, covering retry strategies and priority scheduling."
tags: ["Celery", "Task Queue", "Distributed"]
---

Many AI operations are unsuitable for synchronous processing: model training, batch inference, data preprocessing, report generation, etc. Distributed task queues decouple these time-consuming operations from the request path, improving system throughput and user experience.

## Why Celery

Celery is the most mature distributed task framework in the Python ecosystem, supporting multiple message brokers (RabbitMQ, Redis), result backends (Redis, PostgreSQL), and rich task orchestration primitives (chain, group, chord). Workers scale horizontally and integrate with Kubernetes HPA for elastic scaling.

## Task Design Principles

Good task design follows the idempotency principle — repeated execution of the same task produces no side effects. Task parameters should be serializable and minimal (pass IDs, not full objects). For long-running tasks, implement progress reporting and graceful cancellation. Retry strategies should use exponential backoff to prevent cascading failures.

## Priority and Routing

Different task types have different latency tolerances. Real-time inference requests need high-priority queues, while batch data processing can go into low-priority queues. Celery's routing mechanism dispatches tasks to different worker clusters, achieving resource isolation.

```python
from celery import Celery, chain, group
from celery.utils.log import get_task_logger

app = Celery("ai_tasks", broker="redis://localhost:6379/0", backend="redis://localhost:6379/1")
app.conf.update(
    task_serializer="json",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "tasks.inference.*": {"queue": "high_priority"},
        "tasks.batch.*": {"queue": "low_priority"},
    },
)
logger = get_task_logger(__name__)

@app.task(bind=True, max_retries=3, default_retry_delay=60)
def run_inference(self, model_id: str, input_data: dict) -> dict:
    try:
        import httpx
        resp = httpx.post(f"http://model-server/{model_id}/predict", json=input_data, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)

@app.task
def preprocess(data_id: str) -> dict:
    logger.info(f"Preprocessing {data_id}")
    return {"data_id": data_id, "status": "cleaned"}

@app.task
def aggregate_results(results: list[dict]) -> dict:
    return {"total": len(results), "success": sum(1 for r in results if r.get("status") == "ok")}

# Orchestration: preprocess -> parallel inference -> aggregate
def batch_pipeline(data_ids: list[str], model_id: str):
    workflow = chain(
        group(preprocess.s(did) for did in data_ids),
        group(run_inference.s(model_id, {}) for _ in data_ids),
        aggregate_results.s(),
    )
    return workflow.apply_async()
```
