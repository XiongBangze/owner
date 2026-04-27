---
title: "Docker 容器化 AI 应用"
date: "2026-03-21"
description: "使用 Docker 容器化 AI 应用，涵盖多阶段构建、GPU 支持、镜像优化和健康检查。"
tags: ["Docker", "容器化", "部署"]
---

AI 应用的依赖复杂（Python 版本、CUDA 驱动、模型权重），Docker 容器化是实现环境一致性和可重复部署的最佳实践。

## 多阶段构建

AI 镜像通常很大（PyTorch + CUDA 基础镜像可达数 GB）。多阶段构建将编译依赖和运行时依赖分离：第一阶段安装编译工具和构建 wheel 包，第二阶段仅复制编译产物和运行时依赖，显著减小最终镜像体积。

## GPU 支持

NVIDIA Container Toolkit 允许容器直接访问宿主机 GPU。通过指定 `nvidia/cuda` 基础镜像并在运行时添加 `--gpus` 参数，AI 模型可以在容器内无缝使用 GPU 加速。关键是确保容器内的 CUDA 版本与宿主机驱动兼容。

## 健康检查与优雅关闭

AI 服务的启动时间较长（加载模型权重），健康检查应区分 liveness 和 readiness：liveness 检查进程是否存活，readiness 检查模型是否加载完成。优雅关闭需要处理正在进行的推理请求，避免中断导致数据丢失。

## 镜像安全

生产镜像应使用非 root 用户运行，移除不必要的工具和 shell，定期扫描漏洞。模型权重不应打包进镜像，而是通过挂载卷或启动时从对象存储下载。

```python
# build.py — 自动化 Docker 构建脚本
import subprocess
import sys

CONFIG = {
    "image": "ai-service",
    "base": "nvidia/cuda:12.2.0-runtime-ubuntu22.04",
    "python": "3.11",
}

DOCKERFILE = f"""
# Stage 1: Build
FROM python:{{CONFIG['python']}}-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM {CONFIG['base']}
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/*
COPY --from=builder /install /usr/local
WORKDIR /app
COPY src/ ./src/
RUN useradd -r -s /bin/false appuser
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD python3 -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"
CMD ["python3", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
"""

def build(tag: str = "latest"):
    with open("Dockerfile", "w") as f:
        f.write(DOCKERFILE)
    cmd = ["docker", "build", "-t", f"{CONFIG['image']}:{tag}", "."]
    subprocess.run(cmd, check=True)
    print(f"Built {CONFIG['image']}:{tag}")

def run(tag: str = "latest", gpus: bool = True):
    cmd = ["docker", "run", "-d", "-p", "8000:8000", "--name", CONFIG["image"]]
    if gpus:
        cmd.extend(["--gpus", "all"])
    cmd.append(f"{CONFIG['image']}:{tag}")
    subprocess.run(cmd, check=True)

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "build"
    {"build": build, "run": run}[action]()
```
