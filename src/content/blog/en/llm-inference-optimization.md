---
title: "LLM Inference Optimization"
date: "2026-04-07"
description: "Deep dive into LLM inference optimization techniques, covering quantization, KV Cache, continuous batching, and vLLM in practice."
tags: ["Inference Optimization", "Quantization", "vLLM"]
---

LLM inference bottlenecks stem from two sources: GPU memory consumption due to parameter count, and the sequential nature of autoregressive generation. The optimization goal is to maximize throughput (tokens/s) and minimize Time-To-First-Token (TTFT) while maintaining output quality. Core optimization techniques include model quantization, KV Cache optimization, continuous batching, and speculative decoding.

Quantization is the most straightforward optimization. FP16 → INT8 quantization halves memory usage, and INT4 (GPTQ/AWQ) reduces it to a quarter, with accuracy loss typically within 1-2%. AWQ (Activation-aware Weight Quantization) protects weight channels that significantly impact activation values, achieving near-FP16 quality at INT4. KV Cache stores historical key-value pairs during autoregressive generation; PagedAttention (vLLM's core innovation) borrows from OS virtual memory concepts to manage KV Cache in pages, eliminating memory fragmentation and boosting memory utilization from 60% to over 95%.

Continuous Batching allows new requests to be inserted immediately after individual requests in a batch complete, rather than waiting for the entire batch to finish, improving GPU utilization by 2-5x. Speculative Decoding uses a small model to rapidly generate candidate token sequences, which are then verified in parallel by the large model, achieving 2-3x speedup with identical output distributions.

```python
from vllm import LLM, SamplingParams

# Deploy quantized model with vLLM, auto-enabling PagedAttention and continuous batching
llm = LLM(
    model="TheBloke/Llama-2-13B-chat-AWQ",
    quantization="awq",
    gpu_memory_utilization=0.90,
    max_model_len=4096,
    tensor_parallel_size=1,  # Increase for multi-GPU
)

params = SamplingParams(temperature=0.7, top_p=0.9, max_tokens=512)

# Batch inference: vLLM automatically handles continuous batching scheduling
prompts = [
    "Explain the Transformer architecture",
    "Best practices for Python async programming",
    "How to design a highly available microservices system",
]
outputs = llm.generate(prompts, params)
for out in outputs:
    print(f"Prompt: {out.prompt[:30]}...")
    print(f"Output: {out.outputs[0].text[:100]}...")
    print(f"Tokens/s: {len(out.outputs[0].token_ids) / out.metrics.finished_time:.1f}")
```

vLLM has become the de facto standard for open-source LLM inference, supporting 150+ model architectures and achieving commercial API-level throughput on a single machine.
