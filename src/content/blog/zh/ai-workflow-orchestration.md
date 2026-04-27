---
title: "AI 工作流编排"
date: "2026-03-31"
description: "使用 Prefect 和 Airflow 编排 AI 数据管线与推理工作流，实现可观测、可重试的自动化流程"
tags: [工作流, Prefect, Airflow]
---

AI 应用从原型到生产的关键挑战之一是工作流编排。一个典型的 RAG 数据管线包含文档抓取、解析、分块、Embedding、入库等多个步骤，每步都可能失败，需要重试、监控和调度能力。

**Prefect** 是 Python 原生的现代工作流引擎。它用装饰器 `@flow` 和 `@task` 标注函数即可编排，支持自动重试、并发执行、缓存和实时 UI 监控。相比 Airflow，Prefect 更轻量，不需要 DAG 文件和调度器进程，适合中小规模 AI 管线。

**Airflow** 是老牌编排工具，生态成熟，适合大规模、多团队协作的场景。它的 DAG 定义方式更结构化，内置丰富的 Operator（Kubernetes、Spark、dbt 等），但部署和维护成本较高。

选型建议：团队小、迭代快选 Prefect；企业级、多系统集成选 Airflow。两者都支持定时调度、失败告警和任务依赖管理。对于纯 LLM 链式调用场景，也可考虑 LangGraph 或 CrewAI 等专用框架。

```python
from prefect import flow, task
from prefect.tasks import task_input_hash
from datetime import timedelta

@task(retries=3, retry_delay_seconds=10,
      cache_key_fn=task_input_hash, cache_expiration=timedelta(hours=1))
def parse_document(path: str) -> str:
    import fitz
    doc = fitz.open(path)
    text = "\n".join(p.get_text() for p in doc)
    doc.close()
    return text

@task
def embed_and_store(chunks: list[str]) -> int:
    # 调用 embedding API 并写入向量数据库
    print(f"嵌入 {len(chunks)} 个分块")
    return len(chunks)

@flow(name="rag-ingestion", log_prints=True)
def ingest_pipeline(pdf_path: str):
    text = parse_document(pdf_path)
    chunks = [text[i:i+512] for i in range(0, len(text), 448)]
    count = embed_and_store(chunks)
    print(f"管线完成，共处理 {count} 个分块")

ingest_pipeline("data/report.pdf")
```

生产环境中应配合 Prefect Cloud 或自建 Prefect Server 实现集中监控和调度。
