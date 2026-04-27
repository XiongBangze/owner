---
title: "Data Pipelines and ETL for AI"
date: "2026-03-23"
description: "Build data pipelines for AI training and inference, covering incremental extraction, data cleansing, and quality validation."
tags: ["ETL", "Data Pipeline", "Python"]
---

AI model performance heavily depends on data quality. A robust ETL (Extract-Transform-Load) pipeline is the cornerstone of successful AI projects. This article shows how to build an observable, retryable data pipeline in Python.

## Extract Layer

Data sources are typically diverse: databases, APIs, file systems, message queues. The extract layer must handle incremental pulls (timestamp-based or CDC), connection retries, and rate limiting. Using the generator pattern enables memory-efficient streaming extraction, avoiding OOM from loading entire datasets at once.

## Transform Layer

Data cleansing is the most time-consuming phase. Common operations include deduplication, null filling, format normalization, text tokenization, and embedding generation. Encapsulating each transformation step as an independent function and composing them via pipelines makes unit testing easy and allows plug-and-play flexibility.

## Load & Validate

Before writing to target storage, data quality validation is essential: schema consistency, value ranges, uniqueness constraints, etc. Records that fail validation should be routed to a dead-letter queue rather than blocking the entire pipeline. After loading, record metadata (row count, duration, validation pass rate) to support monitoring and alerting.

```python
import logging
from dataclasses import dataclass, field
from typing import Iterator, Callable

logger = logging.getLogger(__name__)

@dataclass
class PipelineMetrics:
    extracted: int = 0
    transformed: int = 0
    loaded: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)

def extract_from_db(dsn: str, query: str, batch_size: int = 1000) -> Iterator[list[dict]]:
    """Incremental batch extraction using generators to avoid OOM"""
    import psycopg2
    conn = psycopg2.connect(dsn)
    cur = conn.cursor(name="etl_cursor")
    cur.execute(query)
    while batch := cur.fetchmany(batch_size):
        yield [dict(zip([d[0] for d in cur.description], row)) for row in batch]
    cur.close()
    conn.close()

def transform_chain(*fns: Callable[[dict], dict | None]):
    """Compose multiple transform functions into a pipeline"""
    def apply(record: dict) -> dict | None:
        for fn in fns:
            record = fn(record)
            if record is None:
                return None
        return record
    return apply

def clean_text(record: dict) -> dict:
    if text := record.get("content"):
        record["content"] = " ".join(text.split()).strip()
    return record

def validate_schema(required: set[str]):
    def _validate(record: dict) -> dict | None:
        if not required.issubset(record.keys()):
            return None
        return record
    return _validate

def run_pipeline(source: Iterator[list[dict]], transform, load_fn) -> PipelineMetrics:
    metrics = PipelineMetrics()
    for batch in source:
        metrics.extracted += len(batch)
        results = []
        for record in batch:
            try:
                if out := transform(record):
                    results.append(out)
                    metrics.transformed += 1
                else:
                    metrics.failed += 1
            except Exception as e:
                metrics.failed += 1
                metrics.errors.append(str(e))
        if results:
            load_fn(results)
            metrics.loaded += len(results)
    logger.info(f"Pipeline done: {metrics}")
    return metrics
```
