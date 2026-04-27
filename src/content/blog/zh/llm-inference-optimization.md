---
title: "大模型推理优化"
date: "2026-04-07"
description: "深入解析 LLM 推理优化技术，涵盖量化、KV Cache、连续批处理与 vLLM 实战。"
tags: ["推理优化", "量化", "vLLM"]
---

LLM 推理的性能瓶颈主要来自两方面：模型参数量导致的显存占用和自回归生成的串行特性。优化目标是在保持输出质量的前提下，最大化吞吐量（tokens/s）并最小化首 token 延迟（TTFT）。核心优化技术包括模型量化、KV Cache 优化、连续批处理和推测解码。

量化是最直接的优化手段。FP16 → INT8 量化可将显存占用减半，INT4（GPTQ/AWQ）进一步减至四分之一，而精度损失通常在 1-2% 以内。AWQ（Activation-aware Weight Quantization）通过保护对激活值影响大的权重通道，在 INT4 下实现了接近 FP16 的质量。KV Cache 是自回归生成中缓存历史 key-value 的机制，PagedAttention（vLLM 的核心创新）借鉴操作系统虚拟内存思想，将 KV Cache 分页管理，消除了内存碎片，使显存利用率从 60% 提升到 95% 以上。

连续批处理（Continuous Batching）允许在一个批次中的请求完成后立即插入新请求，而非等待整个批次结束，将 GPU 利用率提升 2-5 倍。推测解码（Speculative Decoding）使用小模型快速生成候选 token 序列，再由大模型并行验证，可加速 2-3 倍且输出分布完全一致。

```python
from vllm import LLM, SamplingParams

# 使用 vLLM 部署量化模型，自动启用 PagedAttention 和连续批处理
llm = LLM(
    model="TheBloke/Llama-2-13B-chat-AWQ",
    quantization="awq",
    gpu_memory_utilization=0.90,
    max_model_len=4096,
    tensor_parallel_size=1,  # 多卡时增大
)

params = SamplingParams(temperature=0.7, top_p=0.9, max_tokens=512)

# 批量推理：vLLM 自动进行连续批处理调度
prompts = [
    "解释什么是 Transformer 架构",
    "Python 异步编程的最佳实践",
    "如何设计高可用的微服务系统",
]
outputs = llm.generate(prompts, params)
for out in outputs:
    print(f"Prompt: {out.prompt[:30]}...")
    print(f"Output: {out.outputs[0].text[:100]}...")
    print(f"Tokens/s: {len(out.outputs[0].token_ids) / out.metrics.finished_time:.1f}")
```

vLLM 已成为开源 LLM 推理的事实标准，支持 150+ 模型架构，单机即可达到商业 API 级别的吞吐性能。
