---
title: "WebSocket 实时通信"
date: "2026-03-19"
description: "使用 Python 实现 WebSocket 实时通信，构建支持多房间、心跳检测和消息广播的实时系统。"
tags: ["WebSocket", "实时", "Python"]
---

AI 聊天应用、实时协作编辑、推理进度推送等场景都需要服务端主动向客户端推送数据。WebSocket 提供全双工通信通道，是实现实时交互的首选协议。

## WebSocket vs SSE

Server-Sent Events（SSE）是单向的服务端推送，适合 LLM 流式输出等只需服务端到客户端的场景。WebSocket 是双向通信，适合需要客户端实时发送消息的场景（如聊天室、协作编辑）。两者可以在同一应用中共存，按需选择。

## 连接管理

生产环境中 WebSocket 连接管理是核心挑战。需要处理：连接注册与注销、房间/频道订阅、心跳检测（ping/pong）、断线重连、以及连接数限制。使用内存中的连接注册表管理单节点连接，跨节点广播则通过 Redis Pub/Sub 实现。

## 消息协议设计

定义统一的消息格式（type + payload）便于扩展和路由。常见消息类型包括：chat（聊天消息）、typing（输入状态）、presence（在线状态）、system（系统通知）。消息应包含时间戳和唯一 ID，支持幂等处理和消息排序。

```python
import asyncio
import json
import time
from dataclasses import dataclass, field
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

@dataclass
class Room:
    members: dict[str, WebSocket] = field(default_factory=dict)

    async def broadcast(self, message: dict, exclude: str | None = None):
        data = json.dumps(message)
        for uid, ws in self.members.items():
            if uid != exclude:
                await ws.send_text(data)

class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}

    def get_room(self, room_id: str) -> Room:
        if room_id not in self.rooms:
            self.rooms[room_id] = Room()
        return self.rooms[room_id]

    async def connect(self, room_id: str, user_id: str, ws: WebSocket):
        await ws.accept()
        room = self.get_room(room_id)
        room.members[user_id] = ws
        await room.broadcast({"type": "presence", "user": user_id, "action": "join"}, exclude=user_id)

    async def disconnect(self, room_id: str, user_id: str):
        room = self.get_room(room_id)
        room.members.pop(user_id, None)
        await room.broadcast({"type": "presence", "user": user_id, "action": "leave"})
        if not room.members:
            del self.rooms[room_id]

manager = ConnectionManager()

@app.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(ws: WebSocket, room_id: str, user_id: str):
    await manager.connect(room_id, user_id, ws)
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg.update({"from": user_id, "ts": time.time()})
            room = manager.get_room(room_id)
            await room.broadcast(msg, exclude=user_id)
    except WebSocketDisconnect:
        await manager.disconnect(room_id, user_id)
```
