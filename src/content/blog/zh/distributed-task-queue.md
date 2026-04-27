---
title: "分布式任务队列"
date: "2026-03-22"
description: "使用 Celery 构建分布式任务队列，处理 AI 推理、数据处理等异步任务，涵盖重试策略和优先级调度。"
tags: ["Celery", "任务队列", "分布式"]
---

AI 应用中大量操作不适合同步处理：模型训练、批量推理、数据预处理、报告生成等。分布式任务队列将这些耗时操作从请求链路中解耦，提升系统吞吐量和用户体验。

## 为什么选择 Celery

Celery 是 Python 生态中最成熟的分布式任务框架，支持多种消息代理（RabbitMQ、Redis）、结果后端（Redis、PostgreSQL）和丰富的任务编排原语（chain、group、chord）。其 Worker 可以水平扩展，配合 Kubernetes 的 HPA 实现弹性伸缩。

## 任务设计原则

好的任务设计遵循幂等性原则——同一任务重复执行不会产生副作用。任务参数应可序列化且尽量小（传 ID 而非完整对象）。对于长时间运行的任务，应实现进度上报和优雅取消机制。重试策略采用指数退避，避免雪崩效应。

## 优先级与路由

不同类型的任务对延迟的容忍度不同。实时推理请求需要高优先级队列，而批量数据处理可以放入低优先级队列。通过 Celery 的路由机制，可以将任务分发到不同的 Worker 集群，实现资源隔离。

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
    # 数据清洗和特征工程
    return {"data_id": data_id, "status": "cleaned"}

@app.task
def aggregate_results(results: list[dict]) -> dict:
    return {"total": len(results), "success": sum(1 for r in results if r.get("status") == "ok")}

# 编排：先预处理，再并行推理，最后聚合
def batch_pipeline(data_ids: list[str], model_id: str):
    workflow = chain(
        group(preprocess.s(did) for did in data_ids),
        group(run_inference.s(model_id, {}) for _ in data_ids),
        aggregate_results.s(),
    )
    return workflow.apply_async()
```
