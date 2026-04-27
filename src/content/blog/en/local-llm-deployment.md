---
title: "Local Deployment of Open-Source LLMs"
date: "2026-03-30"
description: "Quickly deploy open-source models like Llama locally using Ollama for offline inference and data privacy"
tags: [Ollama, Llama, Local Deployment]
---

Deploying open-source LLMs locally is essential for data privacy and reducing API costs. With models like Llama 3, Qwen 2.5, and Mistral going open-source, the barrier to local deployment has dropped significantly. **Ollama** is currently the simplest local deployment tool — it wraps model downloading, quantization, and inference serving into a Docker-like experience, launching with a single command.

Hardware requirements: a 7B model (4-bit quantized) needs ~4GB VRAM or 8GB RAM; 13B needs 8GB VRAM; 70B needs 40GB+ VRAM or multi-GPU parallelism. CPU inference works but is slow — at minimum use a consumer GPU (RTX 3060+). Apple Silicon's Metal acceleration performs excellently on Mac.

After deployment, Ollama provides an OpenAI-compatible REST API that integrates directly with existing code. Key optimizations include: choosing the right quantization level (Q4_K_M balances accuracy and speed best); setting `num_ctx` to control context length; using `keep_alive` to manage model residency in memory. For production, consider vLLM or TGI for better throughput and batching.

```python
import requests
from openai import OpenAI

# Pull model via CLI first: ollama pull llama3.1:8b-instruct-q4_K_M

def chat_local(prompt: str, model: str = "llama3.1:8b-instruct-q4_K_M") -> str:
    resp = requests.post("http://localhost:11434/v1/chat/completions", json={
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
    })
    return resp.json()["choices"][0]["message"]["content"]

# Or use the openai SDK directly
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
response = client.chat.completions.create(
    model="llama3.1:8b-instruct-q4_K_M",
    messages=[{"role": "user", "content": "Write a quicksort in Python"}],
)
print(response.choices[0].message.content)
```

Locally deployed models can be customized with Modelfiles to set system prompts and parameters for domain-specific use cases.
