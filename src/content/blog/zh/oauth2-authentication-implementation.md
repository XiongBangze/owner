---
title: "OAuth2 认证实现"
date: "2026-03-05"
description: "深入讲解 OAuth2 授权码模式的后端实现，包括令牌签发、刷新机制与安全最佳实践。"
tags: ["OAuth2", "认证", "安全"]
---

OAuth2 是当前最主流的授权框架，广泛应用于第三方登录、API 网关鉴权等场景。其核心思想是将"授权"与"认证"解耦，通过令牌（Token）机制实现资源的安全访问。

在授权码模式（Authorization Code Flow）中，客户端首先将用户重定向到授权服务器，用户同意授权后，授权服务器返回一个短生命周期的授权码。客户端再用该授权码向令牌端点换取 Access Token 和 Refresh Token。Access Token 用于访问受保护资源，Refresh Token 用于在 Access Token 过期后静默续期。

安全方面需要注意：Access Token 应设置较短的过期时间（如 15 分钟）；Refresh Token 必须存储在安全的 HttpOnly Cookie 或服务端会话中；所有令牌端点必须使用 HTTPS；建议结合 PKCE（Proof Key for Code Exchange）防止授权码拦截攻击。对于高安全场景，还应实现令牌吊销（Token Revocation）端点，允许用户主动注销。

以下示例使用 FastAPI 和 `python-jose` 实现 JWT 令牌签发与验证：

```python
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt

app = FastAPI()
SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return username

@app.post("/token")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    # 实际项目中应查询数据库验证用户
    if form.username != "admin" or form.password != "secret":
        raise HTTPException(status_code=400, detail="Incorrect credentials")
    token = create_access_token(
        data={"sub": form.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}

@app.get("/protected")
async def protected_route(user: str = Depends(get_current_user)):
    return {"message": f"Hello, {user}"}
```

该实现涵盖了令牌签发、依赖注入式鉴权和受保护路由三个核心环节，可作为生产级 OAuth2 服务的起点。
