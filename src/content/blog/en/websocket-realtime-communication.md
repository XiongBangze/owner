---
title: "WebSocket Real-Time Communication"
date: "2026-03-19"
description: "Implement WebSocket real-time communication in Python, building a system with multi-room support, heartbeat detection, and message broadcasting."
tags: ["WebSocket", "Real-time", "Python"]
---

AI chat applications, real-time collaborative editing, and inference progress pushing all require the server to proactively push data to clients. WebSocket provides a full-duplex communication channel and is the preferred protocol for real-time interaction.

## WebSocket vs SSE

Server-Sent Events (SSE) is unidirectional server-to-client push, suitable for scenarios like LLM streaming output. WebSocket is bidirectional, ideal for scenarios requiring real-time client messaging (chat rooms, collaborative editing). Both can coexist in the same application, chosen as needed.

## Connection Management

WebSocket connection management is the core challenge in production. It involves: connection registration and deregistration, room/channel subscriptions, heartbeat detection (ping/pong), reconnection handling, and connection limits. An in-memory connection registry manages single-node connections, while cross-node broadcasting uses Redis Pub/Sub.

## Message Protocol Design

A unified message format (type + payload) facilitates extension and routing. Common message types include: chat (messages), typing (input status), presence (online status), and system (notifications). Messages should include timestamps and unique IDs to support idempotent processing and ordering.

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
