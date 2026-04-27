---
title: "日志系统设计"
date: "2026-03-18"
description: "设计结构化日志系统，集成 ELK 栈实现日志采集、搜索和告警，提升 AI 服务的可观测性。"
tags: ["日志", "ELK", "Python"]
---

AI 服务的调试和运维高度依赖日志。非结构化的文本日志难以检索和分析，结构化日志配合集中式日志平台（ELK）是生产环境的标准方案。

## 结构化日志

传统的 `print` 或纯文本日志在分布式系统中几乎无法使用。结构化日志以 JSON 格式输出，每条日志包含时间戳、级别、服务名、请求 ID、用户 ID 等字段。这使得日志可以被 Elasticsearch 索引，支持精确查询和聚合分析。Python 的 `logging` 模块配合自定义 Formatter 即可实现。

## 请求追踪

在微服务架构中，一个用户请求可能经过多个服务。通过在请求入口生成唯一的 trace_id 并在服务间传递，可以将分散在不同服务的日志串联起来。结合 FastAPI 中间件，可以自动为每个请求注入追踪上下文。

## AI 特有的日志需求

AI 服务需要记录额外信息：模型名称和版本、推理延迟、token 使用量、prompt 长度等。这些指标既用于成本核算，也用于模型性能监控。敏感的用户输入应脱敏后再记录，避免隐私泄露。

## 日志采集与告警

Filebeat 采集容器日志发送到 Logstash 进行解析和富化，最终存入 Elasticsearch。Kibana 提供可视化仪表盘，配合 Watcher 或 ElastAlert 实现异常告警（如错误率突增、推理延迟飙升）。

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
