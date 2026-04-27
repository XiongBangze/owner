---
title: "数据管道与 ETL"
date: "2026-03-23"
description: "构建面向 AI 训练和推理的数据管道，涵盖增量抽取、数据清洗转换和质量校验。"
tags: ["ETL", "数据管道", "Python"]
---

AI 模型的效果高度依赖数据质量。一个健壮的 ETL（Extract-Transform-Load）管道是 AI 项目成功的基石。本文介绍如何用 Python 构建可观测、可重试的数据管道。

## 抽取层（Extract）

数据源通常多样化：数据库、API、文件系统、消息队列。抽取层需要处理增量拉取（基于时间戳或 CDC）、连接重试和速率限制。使用生成器模式可以实现内存高效的流式抽取，避免一次性加载全量数据导致 OOM。

## 转换层（Transform）

数据清洗是最耗时的环节。常见操作包括：去重、空值填充、格式标准化、文本分词和 embedding 生成。将每个转换步骤封装为独立函数，通过管道组合，既便于单元测试，也方便按需插拔。

## 加载与质量校验（Load & Validate）

写入目标存储前，必须进行数据质量校验：schema 一致性、数值范围、唯一性约束等。校验失败的记录应写入死信队列，而非阻塞整个管道。加载完成后记录元数据（行数、耗时、校验通过率），为监控和告警提供依据。

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
    """增量批次抽取，使用生成器避免 OOM"""
    import psycopg2
    conn = psycopg2.connect(dsn)
    cur = conn.cursor(name="etl_cursor")
    cur.execute(query)
    while batch := cur.fetchmany(batch_size):
        yield [dict(zip([d[0] for d in cur.description], row)) for row in batch]
    cur.close()
    conn.close()

def transform_chain(*fns: Callable[[dict], dict | None]):
    """组合多个转换函数为管道"""
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
