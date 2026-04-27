---
title: "AI 应用的测试策略"
date: "2026-03-28"
description: "针对 LLM 应用的测试与评估方法，包括单元测试、集成测试和自动化评估框架"
tags: [测试, 评估, LLM]
---

AI 应用的测试与传统软件不同——LLM 的输出具有非确定性，无法用精确匹配断言。需要建立多层次的测试策略：确定性逻辑用单元测试，LLM 交互用评估（Evaluation）框架。

**第一层：确定性单元测试。** 对 prompt 模板拼接、输出解析、工具调用路由等确定性逻辑编写常规单元测试。这些代码不涉及 LLM 调用，可以快速执行且结果稳定。Mock LLM 响应来测试下游处理逻辑。

**第二层：LLM 输出评估。** 使用评估数据集（问题+参考答案）和评估指标衡量 LLM 输出质量。常用指标包括：相关性（Relevance）、忠实度（Faithfulness，是否基于检索内容）、有害性（Harmfulness）。可以用 LLM-as-Judge 方式让另一个模型打分，也可用 RAGAS、DeepEval 等框架自动化评估。

**第三层：端到端集成测试。** 模拟真实用户场景，验证从输入到最终输出的完整链路。关注延迟、错误率和边界情况（空输入、超长文本、多语言混合）。

```python
import pytest
from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric

def parse_json_response(text: str) -> dict:
    import json, re
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return json.loads(match.group()) if match else {}

def test_parse_json_response():
    raw = 'Here is the result: {"name": "test", "score": 0.95}'
    assert parse_json_response(raw) == {"name": "test", "score": 0.95}
    assert parse_json_response("no json here") == {}

def test_rag_answer_quality():
    test_case = LLMTestCase(
        input="什么是 RAG？",
        actual_output="RAG 是检索增强生成，结合检索和生成来回答问题。",
        retrieval_context=["RAG 通过检索外部知识库增强 LLM 的回答能力。"],
    )
    relevancy = AnswerRelevancyMetric(threshold=0.7)
    faithfulness = FaithfulnessMetric(threshold=0.8)
    evaluate([test_case], [relevancy, faithfulness])
```

建议在 CI 中运行确定性测试，评估测试定期（每日/每周）执行并追踪指标趋势。
