---
title: "本地部署开源大模型"
date: "2026-03-30"
description: "使用 Ollama 在本地快速部署 Llama 等开源大模型，实现离线推理与隐私保护"
tags: [Ollama, Llama, 本地部署]
---

本地部署开源大模型是保障数据隐私、降低 API 成本的重要方案。随着 Llama 3、Qwen 2.5、Mistral 等模型的开源，本地部署的门槛大幅降低。**Ollama** 是目前最简便的本地部署工具，它将模型下载、量化、推理服务封装为类似 Docker 的体验，一条命令即可启动。

硬件要求方面：7B 模型（4-bit 量化）需要约 4GB 显存或 8GB 内存；13B 模型需要 8GB 显存；70B 模型需要 40GB+ 显存或多卡并行。CPU 推理可行但速度较慢，建议至少使用消费级 GPU（RTX 3060 以上）。Apple Silicon 的 Metal 加速在 Mac 上表现优异。

部署后 Ollama 提供兼容 OpenAI 格式的 REST API，可直接对接现有代码。关键优化点包括：选择合适的量化级别（Q4_K_M 是精度与速度的最佳平衡）；设置 `num_ctx` 控制上下文长度；使用 `keep_alive` 参数管理模型在内存中的驻留时间。对于生产场景，推荐使用 vLLM 或 TGI 获得更好的吞吐量和批处理能力。

```python
import requests
from openai import OpenAI

# 命令行先拉取模型: ollama pull llama3.1:8b-instruct-q4_K_M

def chat_local(prompt: str, model: str = "llama3.1:8b-instruct-q4_K_M") -> str:
    resp = requests.post("http://localhost:11434/v1/chat/completions", json={
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
    })
    return resp.json()["choices"][0]["message"]["content"]

# 也可用 openai SDK 直接对接
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
response = client.chat.completions.create(
    model="llama3.1:8b-instruct-q4_K_M",
    messages=[{"role": "user", "content": "用 Python 写一个快速排序"}],
)
print(response.choices[0].message.content)
```

本地部署的模型可通过 Modelfile 自定义系统提示词和参数，实现领域定制化。
