---
title: "Observability for AI Applications"
date: "2026-04-11"
description: "Build end-to-end observability for LLM applications, covering tracing, evaluation metrics, and alerting practices."
tags: ["Observability", "LangSmith", "Monitoring"]
---

The key difference between LLM applications and traditional software is output non-determinism — the same input may produce answers of varying quality. This makes observability shift from "nice-to-have" to "mission-critical." A comprehensive LLM observability system must cover three dimensions: Tracing (tracking the complete chain of each invocation), Evaluation (assessing output quality), and Monitoring (tracking latency, cost, and anomalies).

LangSmith is the observability platform in the LangChain ecosystem, automatically capturing every execution detail of Chains/Agents, including prompt template rendering, LLM call parameters, tool execution results, and final outputs. Beyond LangSmith, OpenTelemetry is a powerful open-source alternative — custom Spans can integrate LLM calls into existing distributed tracing infrastructure.

Core monitoring metrics include: P50/P99 latency (direct reflection of user experience), token usage and cost (budget control), error and retry rates (stability), and LLM-as-Judge output quality scores. It's recommended to record input/output, model version, latency, and token count for every Trace, enabling post-hoc analysis and regression testing.

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
            {"role": "system", "content": f"Answer based on this context:\n{context}"},
            {"role": "user", "content": question},
        ],
    )
    latency = time.time() - start
    answer = response.choices[0].message.content
    tokens = response.usage.total_tokens
    # Custom metrics are automatically attached to the LangSmith trace
    return {"answer": answer, "latency_ms": latency * 1000, "total_tokens": tokens}

# Batch evaluation
def evaluate_batch(test_cases: list[dict]):
    for case in test_cases:
        result = answer_question(case["question"], case["context"])
        score = ls_client.evaluate_run(
            result, evaluators=["correctness", "relevance"]
        )
        print(f"Q: {case['question']} | Score: {score}")
```

In production, set alert thresholds for latency exceeding 5 seconds and error rates above 1%, and regularly run evaluation datasets to detect model quality regressions.
