---
title: "构建企业级 Chatbot"
date: "2026-04-10"
description: "从架构设计到落地部署，全面解析企业级 Chatbot 的技术方案与最佳实践。"
tags: ["Chatbot", "架构设计", "Python"]
---

企业级 Chatbot 远不止"套一层 ChatGPT API"那么简单。它需要处理多轮对话状态管理、知识库检索增强（RAG）、权限控制、对话路由、兜底策略和审计日志等复杂需求。一个成熟的架构通常包含四层：接入层（多渠道适配）、对话管理层（意图识别与状态机）、知识层（向量检索 + 结构化查询）、模型层（LLM 调用与 prompt 管理）。

多轮对话的核心挑战是上下文窗口管理。简单的做法是将所有历史消息塞入 prompt，但这会快速耗尽 token 预算。更好的方案是实现滑动窗口 + 摘要机制：保留最近 N 轮原始对话，更早的历史通过 LLM 压缩为摘要。对话路由则根据用户意图将请求分发到不同的处理管线——FAQ 走检索、数据查询走 SQL Agent、闲聊走轻量模型。

生产环境还需考虑：敏感信息过滤（PII 脱敏）、回答置信度评估（低置信度转人工）、A/B 测试框架（对比不同 prompt 策略）、以及完善的降级方案（模型超时时返回预设回答）。

```python
from dataclasses import dataclass, field
from openai import OpenAI

@dataclass
class ChatSession:
    history: list[dict] = field(default_factory=list)
    summary: str = ""
    max_recent: int = 6

    def add(self, role: str, content: str):
        self.history.append({"role": role, "content": content})
        if len(self.history) > self.max_recent * 2:
            self._compress()

    def _compress(self):
        client = OpenAI()
        old = self.history[:-self.max_recent]
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": f"用3句话总结对话要点:\n{old}"}],
        )
        self.summary = resp.choices[0].message.content
        self.history = self.history[-self.max_recent:]

    def get_messages(self, system_prompt: str) -> list[dict]:
        msgs = [{"role": "system", "content": system_prompt}]
        if self.summary:
            msgs.append({"role": "system", "content": f"历史摘要: {self.summary}"})
        msgs.extend(self.history)
        return msgs

def chat(session: ChatSession, user_input: str) -> str:
    session.add("user", user_input)
    client = OpenAI()
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=session.get_messages("你是企业客服助手，回答需准确专业。"),
    )
    answer = resp.choices[0].message.content
    session.add("assistant", answer)
    return answer
```

建议从 MVP 开始迭代：先上线单轮 RAG 问答，再逐步加入多轮对话、路由和高级功能。
