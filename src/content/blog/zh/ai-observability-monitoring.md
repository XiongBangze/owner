---
title: "AI 应用的可观测性"
date: "2026-04-11"
description: "构建 LLM 应用的全链路可观测体系，涵盖 Trace、评估指标与告警实践。"
tags: ["可观测性", "LangSmith", "监控"]
---

LLM 应用与传统软件的关键区别在于其输出的不确定性——同样的输入可能产生不同质量的回答。这使得可观测性（Observability）从"锦上添花"变为"生死攸关"。一个完善的 LLM 可观测体系需要覆盖三个维度：Tracing（追踪每次调用的完整链路）、Evaluation（评估输出质量）、Monitoring（监控延迟、成本和异常）。

LangSmith 是 LangChain 生态中的可观测平台，能自动捕获 Chain/Agent 的每一步执行细节，包括 prompt 模板渲染、LLM 调用参数、工具执行结果和最终输出。除了 LangSmith，OpenTelemetry 也是一个强大的开源选择，通过自定义 Span 可以将 LLM 调用纳入已有的分布式追踪体系。

核心监控指标包括：P50/P99 延迟（用户体验的直接反映）、Token 使用量与成本（预算控制）、错误率与重试率（稳定性）、以及基于 LLM-as-Judge 的输出质量评分。建议对每个 Trace 记录输入输出、模型版本、延迟和 token 数，便于事后分析和回归测试。

```python
from langsmith import traceable, Client
from openai import OpenAI
import time

client = OpenAI()
ls_client = Client()

@traceable(name="qa-chain", run_type="chain")
def answer_question(question: str, context: str) -> dict:
    start = time.time()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": f"基于以下上下文回答问题:\n{context}"},
            {"role": "user", "content": question},
        ],
    )
    latency = time.time() - start
    answer = response.choices[0].message.content
    tokens = response.usage.total_tokens
    # 自定义指标会自动附加到 LangSmith trace
    return {"answer": answer, "latency_ms": latency * 1000, "total_tokens": tokens}

# 批量评估
def evaluate_batch(test_cases: list[dict]):
    for case in test_cases:
        result = answer_question(case["question"], case["context"])
        score = ls_client.evaluate_run(
            result, evaluators=["correctness", "relevance"]
        )
        print(f"Q: {case['question']} | Score: {score}")
```

生产环境中建议设置延迟超过 5 秒和错误率超过 1% 的告警阈值，并定期运行评估数据集检测模型质量回归。
